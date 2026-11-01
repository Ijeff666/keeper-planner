// Data layer. Every record is a JSON document in one Supabase table, `docs (user_id, coll, id, data)`,
// so Claude can read and edit the same rows with plain SQL. Writes apply locally at once, wait in an
// outbox (kept in localStorage), and flush when online. Without Supabase config it runs in local mode.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { debounce, sortBlocks } from './util.js';

let client = null;
export async function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kp-auth' },
    });
  }
  return client;
}

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export { ls };

const isNetworkError = (e) => !navigator.onLine || /fetch|network|timeout|load failed/i.test(e?.message || '');

// Collections Claude edits by SQL. An edit to one of these is checked against the server copy before it goes out.
const SHARED = new Set(['settings', 'programs', 'sessions', 'templates', 'days', 'checkins']);

// Timestamps arrive as ISO from the REST API and in Postgres text form from realtime, so compare instants.
const instant = (s) => (s ? Date.parse(String(s).replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')) : NaN);
const sameTime = (a, b) => instant(a) === instant(b);
// jsonb from the server orders keys differently from objects built here, so compare with sorted keys.
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
const same = (a, b) => stable(a) === stable(b);

// Three-way merge of a doc edited here while Claude changed it on the server. Fields changed here keep this device's
// value and everything else takes Claude's. A day's blocks merge one by one by id, so a block Claude moved and a block
// added here both survive.
export function mergeDoc(base, local, server) {
  const b = base || {}, l = local || {};
  const out = { ...(server || {}) };
  for (const k of new Set([...Object.keys(l), ...Object.keys(b)])) {
    if (k === 'blocks' || same(l[k], b[k])) continue;
    if (l[k] === undefined) delete out[k]; else out[k] = l[k];
  }
  if (Array.isArray(server?.blocks) || Array.isArray(l.blocks)) {
    const by = (xs) => new Map((xs || []).map((x) => [x.id, x]));
    const B = by(b.blocks), L = by(l.blocks), S = by(server?.blocks);
    const blocks = [];
    for (const id of new Set([...S.keys(), ...L.keys()])) {
      const pick = same(L.get(id), B.get(id)) ? S.get(id) : L.get(id);
      if (pick) blocks.push(pick);
    }
    out.blocks = sortBlocks(blocks);
  }
  return out;
}

export class Store {
  constructor(sb, userId) {
    this.sb = sb;
    this.uid = userId || 'local';
    this.cacheKey = `kp:cache:${this.uid}`;
    this.outKey = `kp:outbox:${this.uid}`;
    const cache = ls.get(this.cacheKey) || {};
    this.docs = cache.docs || {};
    // The server's updated_at for each doc as last synced here, to tell when Claude changed one since.
    this.base = cache.base || {};
    this.outbox = ls.get(this.outKey) || [];
    // The cache is written on a short delay but the outbox immediately, so replay it: an offline start must show the last writes.
    for (const op of this.outbox) {
      if (op.op === 'put') (this.docs[op.coll] ||= {})[op.id] = op.data;
      else if (this.docs[op.coll]) delete this.docs[op.coll][op.id];
    }
    this.listeners = new Set();
    this.version = 0;
    this.status = sb ? 'loading' : 'local';
    this.loaded = !sb;
    this.lastLoad = 0;
    this.loadedRows = null;
    this.flushing = null;
    this.retries = 0;
    this.onError = null;
    this.onMerge = null;
    this.saveCache = debounce(() => ls.set(this.cacheKey, { docs: this.docs, base: this.base }), 400);
    this.scheduleFlush = debounce(() => this.flush(), 700);
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  // Android can kill a backgrounded tab without warning, so pending saves go out the moment the page hides.
  persistNow() { this.saveCache.flush(); this.flush(); }
  emit() { this.version++; for (const fn of this.listeners) fn(this.version); }
  setStatus(s) { if (this.status !== s) { this.status = s; this.emit(); } }

  get(coll, id) { return this.docs[coll]?.[id]; }
  all(coll) { return this.docs[coll] || {}; }
  isEmpty() { return !this.docs.settings?.main; }

  put(coll, id, data) {
    const before = this.docs[coll]?.[id];
    (this.docs[coll] ||= {})[id] = data;
    this.queue({ op: 'put', coll, id, data }, before);
    this.afterWrite();
  }
  update(coll, id, partial) { this.put(coll, id, { ...(this.get(coll, id) || {}), ...partial }); }
  del(coll, id) {
    const before = this.docs[coll]?.[id];
    if (this.docs[coll]) delete this.docs[coll][id];
    this.queue({ op: 'del', coll, id }, before);
    this.afterWrite();
  }
  // Many writes, one re-render.
  putMany(rows) {
    for (const [coll, id, data] of rows) {
      const before = this.docs[coll]?.[id];
      (this.docs[coll] ||= {})[id] = data;
      this.queue({ op: 'put', coll, id, data }, before);
    }
    this.afterWrite();
  }

  // One pending op per doc. Its first edit remembers the synced copy it started from, which later edits keep,
  // so a merge with Claude's version knows exactly what changed here.
  queue(op, before) {
    if (!this.sb) return;
    const prev = this.outbox.find((o) => o.coll === op.coll && o.id === op.id);
    op.base = prev ? prev.base : this.base[op.coll]?.[op.id] ?? null;
    if (SHARED.has(op.coll)) op.from = prev ? prev.from : before ?? null;
    this.outbox = this.outbox.filter((o) => o !== prev);
    this.outbox.push(op);
  }
  afterWrite() {
    ls.set(this.outKey, this.outbox);
    this.saveCache();
    if (this.sb) { if (this.status === 'synced') this.status = 'syncing'; this.scheduleFlush(); }
    this.emit();
  }

  // Callers share the flush in flight, so load() can wait for it.
  flush() {
    if (!this.sb || !this.outbox.length) return this.flushing || Promise.resolve();
    return (this.flushing ||= this.send().finally(() => { this.flushing = null; }));
  }

  async send() {
    if (!navigator.onLine) { this.setStatus('offline'); return; }
    // Ops the server refused this round. They stay queued for a retry: a refusal (an expired session, a timeout, a
    // server error) usually clears, and dropping the op would lose the edit at the next load.
    const held = [];
    let firstError = null;
    for (;;) {
      const pending = this.outbox.filter((o) => !held.includes(o));
      if (!pending.length) break;
      const batch = [];
      if (pending[0].op === 'del') batch.push(pending[0]);
      else for (const o of pending) { if (o.op !== 'put' || batch.length >= 200) break; batch.push(o); }
      if (await this.reconcile(batch) === 'offline') { this.setStatus('offline'); return; }
      const error = await this.write(batch);
      if (!error) continue;
      if (isNetworkError(error)) { this.setStatus('offline'); return; }
      // One bad row fails the whole batch, so the rows go one at a time and the rest still save.
      if (batch.length > 1) {
        for (const o of batch) {
          const e = await this.write([o]);
          if (e && isNetworkError(e)) { this.setStatus('offline'); return; }
          if (e) { held.push(o); firstError ||= e; }
        }
      } else { held.push(...batch); firstError ||= error; }
    }
    if (!held.length) { this.retries = 0; this.setStatus('synced'); return; }
    if (!this.retries) this.report(firstError);
    this.retries++;
    this.setStatus('error');
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.flush(), Math.min(300000, 5000 * 2 ** Math.min(6, this.retries - 1)));
  }

  // Sends the ops and returns the error, if any. Success takes exactly these ops off the queue; an edit made while
  // the request was out stays for the next round.
  async write(ops) {
    let res;
    try {
      if (ops[0].op === 'put') {
        const rows = ops.map((o) => ({ user_id: this.uid, coll: o.coll, id: o.id, data: o.data, updated_at: new Date().toISOString(), updated_by: 'app' }));
        res = await this.sb.from('docs').upsert(rows, { onConflict: 'user_id,coll,id' }).select('coll,id,updated_at');
      } else {
        res = await this.sb.from('docs').delete().match({ user_id: this.uid, coll: ops[0].coll, id: ops[0].id });
      }
    } catch (e) { return e; }
    if (res.error) return res.error;
    for (const r of res.data || []) (this.base[r.coll] ||= {})[r.id] = r.updated_at;
    if (ops[0].op === 'del') delete this.base[ops[0].coll]?.[ops[0].id];
    this.outbox = this.outbox.filter((o) => !ops.includes(o));
    ls.set(this.outKey, this.outbox);
    this.saveCache();
    return null;
  }

  // Before an edit to a doc Claude also writes goes out, look at the server copy. If Claude changed it since this
  // device last synced, merge the two instead of letting this device's copy silently replace Claude's.
  async reconcile(batch) {
    const ops = batch.filter((o) => o.op === 'put' && SHARED.has(o.coll));
    if (!ops.length) return;
    let res;
    try {
      res = await this.sb.from('docs').select('coll,id,data,updated_at,updated_by').eq('user_id', this.uid).in('id', [...new Set(ops.map((o) => o.id))]);
    } catch (e) { res = { error: e }; }
    if (res.error) return isNetworkError(res.error) ? 'offline' : undefined;
    let merged = 0;
    for (const o of ops) {
      if (this.rebase(o, res.data.find((r) => r.coll === o.coll && r.id === o.id))) { (this.docs[o.coll] ||= {})[o.id] = o.data; merged++; }
    }
    if (merged) this.afterMerge(merged);
  }

  // Folds Claude's newer server copy into a pending edit. Rows this app wrote, or the version the edit started from, need nothing.
  rebase(op, row) {
    if (!row || op.op !== 'put' || !SHARED.has(op.coll) || row.updated_by === 'app' || sameTime(row.updated_at, op.base)) return false;
    op.data = mergeDoc(op.from, op.data, row.data);
    op.base = row.updated_at;
    op.from = row.data;
    return true;
  }
  afterMerge(n) {
    ls.set(this.outKey, this.outbox);
    this.saveCache();
    this.emit();
    this.onMerge?.(n);
  }

  report(error) {
    console.error('[store]', error);
    this.onError?.(error?.message || 'A change could not be saved.');
  }

  async load() {
    if (!this.sb) { this.loaded = true; this.emit(); return; }
    if (!navigator.onLine) { this.loaded = Object.keys(this.docs).length > 0; this.setStatus('offline'); return; }
    await this.flushing;
    // Writes that finish while the read below is out may be missing from it, so they are laid back on top afterwards.
    const sent = [...this.outbox];
    const rows = [];
    for (let from = 0; ; from += 1000) {
      // Ordered by key so pages can neither skip nor repeat a row.
      const { data, error } = await this.sb.from('docs').select('coll,id,data,updated_at,updated_by').eq('user_id', this.uid)
        .order('coll').order('id').range(from, from + 999);
      if (error) {
        if (isNetworkError(error)) { this.setStatus('offline'); } else { this.report(error); this.setStatus('error'); }
        this.loaded = Object.keys(this.docs).length > 0;
        this.emit();
        return;
      }
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const docs = {}, base = {}, byKey = new Map();
    for (const r of rows) {
      (docs[r.coll] ||= {})[r.id] = r.data;
      (base[r.coll] ||= {})[r.id] = r.updated_at;
      byKey.set(`${r.coll}/${r.id}`, r);
    }
    // Changes made on this device and not yet sent win over what the server had, merged with anything Claude changed.
    let merged = 0;
    for (const op of this.outbox) if (this.rebase(op, byKey.get(`${op.coll}/${op.id}`))) merged++;
    for (const op of [...sent.filter((o) => !this.outbox.includes(o)), ...this.outbox]) {
      if (op.op === 'put') (docs[op.coll] ||= {})[op.id] = op.data;
      else if (docs[op.coll]) delete docs[op.coll][op.id];
    }
    this.docs = docs;
    this.base = base;
    this.loaded = true;
    this.loadedRows = rows.length;
    this.lastLoad = Date.now();
    this.saveCache();
    this.status = this.outbox.length ? 'syncing' : 'synced';
    if (merged) this.afterMerge(merged); else this.emit();
    this.flush();
  }

  // Live updates, e.g. when Claude edits the plan while the app is open.
  listen() {
    if (!this.sb || this.channel) return;
    this.channel = this.sb.channel(`docs-${this.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: `user_id=eq.${this.uid}` }, (p) => {
        const row = p.new && p.new.coll ? p.new : null;
        const key = row || p.old;
        if (!key?.coll) return;
        // Realtime can't filter DELETE events by user, so another account's deletes arrive here too.
        if (key.user_id && key.user_id !== this.uid) return;
        const op = this.outbox.find((o) => o.coll === key.coll && o.id === key.id);
        if (op) {
          if (row && this.rebase(op, row)) { (this.docs[op.coll] ||= {})[op.id] = op.data; this.afterMerge(1); }
          return;
        }
        if (p.eventType === 'DELETE') { if (this.docs[key.coll]) delete this.docs[key.coll][key.id]; delete this.base[key.coll]?.[key.id]; }
        else { (this.docs[row.coll] ||= {})[row.id] = row.data; (this.base[row.coll] ||= {})[row.id] = row.updated_at; }
        this.saveCache();
        this.emit();
      })
      .subscribe();
  }

  stop() { if (this.channel) { this.sb.removeChannel(this.channel); this.channel = null; } clearTimeout(this.retryTimer); }
}
