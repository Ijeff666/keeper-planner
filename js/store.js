// Data layer. Every record is a JSON document in one Supabase table, `docs (user_id, coll, id, data)`,
// so Claude can read and edit the same rows with plain SQL. Writes apply locally at once, wait in an
// outbox (kept in localStorage), and flush when online. Without Supabase config it runs in local mode.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { debounce } from './util.js';

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

export class Store {
  constructor(sb, userId) {
    this.sb = sb;
    this.uid = userId || 'local';
    this.cacheKey = `kp:cache:${this.uid}`;
    this.outKey = `kp:outbox:${this.uid}`;
    this.docs = ls.get(this.cacheKey)?.docs || {};
    this.outbox = ls.get(this.outKey) || [];
    this.listeners = new Set();
    this.version = 0;
    this.status = sb ? 'loading' : 'local';
    this.loaded = !sb;
    this.lastLoad = 0;
    this.flushing = false;
    this.onError = null;
    this.saveCache = debounce(() => ls.set(this.cacheKey, { docs: this.docs }), 400);
    this.scheduleFlush = debounce(() => this.flush(), 700);
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.version++; for (const fn of this.listeners) fn(this.version); }
  setStatus(s) { if (this.status !== s) { this.status = s; this.emit(); } }

  get(coll, id) { return this.docs[coll]?.[id]; }
  all(coll) { return this.docs[coll] || {}; }
  isEmpty() { return !this.docs.settings?.main; }

  put(coll, id, data) {
    (this.docs[coll] ||= {})[id] = data;
    this.enqueue({ op: 'put', coll, id, data });
  }
  update(coll, id, partial) { this.put(coll, id, { ...(this.get(coll, id) || {}), ...partial }); }
  del(coll, id) {
    if (this.docs[coll]) delete this.docs[coll][id];
    this.enqueue({ op: 'del', coll, id });
  }
  // Many writes, one re-render.
  putMany(rows) {
    for (const [coll, id, data] of rows) {
      (this.docs[coll] ||= {})[id] = data;
      this.outbox = this.outbox.filter((o) => !(o.coll === coll && o.id === id));
      if (this.sb) this.outbox.push({ op: 'put', coll, id, data });
    }
    this.afterWrite();
  }

  enqueue(op) {
    this.outbox = this.outbox.filter((o) => !(o.coll === op.coll && o.id === op.id));
    if (this.sb) this.outbox.push(op);
    this.afterWrite();
  }
  afterWrite() {
    ls.set(this.outKey, this.outbox);
    this.saveCache();
    if (this.sb) { if (this.status === 'synced') this.status = 'syncing'; this.scheduleFlush(); }
    this.emit();
  }

  async flush() {
    if (!this.sb || this.flushing || !this.outbox.length) return;
    if (!navigator.onLine) { this.setStatus('offline'); return; }
    this.flushing = true;
    try {
      while (this.outbox.length) {
        const op = this.outbox[0];
        // Upserts go in batches of consecutive puts to keep a big seed or import fast.
        if (op.op === 'put') {
          const batch = [];
          for (const o of this.outbox) { if (o.op !== 'put' || batch.length >= 200) break; batch.push(o); }
          const rows = batch.map((o) => ({ user_id: this.uid, coll: o.coll, id: o.id, data: o.data, updated_at: new Date().toISOString(), updated_by: 'app' }));
          const { error } = await this.sb.from('docs').upsert(rows, { onConflict: 'user_id,coll,id' });
          if (error) { if (isNetworkError(error)) { this.setStatus('offline'); return; } this.report(error); }
          this.outbox = this.outbox.filter((o) => !batch.includes(o));
        } else {
          const { error } = await this.sb.from('docs').delete().match({ user_id: this.uid, coll: op.coll, id: op.id });
          if (error) { if (isNetworkError(error)) { this.setStatus('offline'); return; } this.report(error); }
          this.outbox = this.outbox.filter((o) => o !== op);
        }
        ls.set(this.outKey, this.outbox);
      }
      this.setStatus('synced');
    } finally {
      this.flushing = false;
      if (this.outbox.length && navigator.onLine && this.status !== 'offline') this.scheduleFlush();
    }
  }

  report(error) {
    console.error('[store]', error);
    this.onError?.(error.message || 'A change could not be saved.');
  }

  async load() {
    if (!this.sb) { this.loaded = true; this.emit(); return; }
    if (!navigator.onLine) { this.loaded = Object.keys(this.docs).length > 0; this.setStatus('offline'); return; }
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb.from('docs').select('coll,id,data').eq('user_id', this.uid).range(from, from + 999);
      if (error) {
        if (isNetworkError(error)) { this.setStatus('offline'); } else { this.report(error); this.setStatus('error'); }
        this.loaded = Object.keys(this.docs).length > 0;
        this.emit();
        return;
      }
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const docs = {};
    for (const r of rows) (docs[r.coll] ||= {})[r.id] = r.data;
    // Changes made offline on this device win over what the server had.
    for (const op of this.outbox) {
      if (op.op === 'put') (docs[op.coll] ||= {})[op.id] = op.data;
      else if (docs[op.coll]) delete docs[op.coll][op.id];
    }
    this.docs = docs;
    this.loaded = true;
    this.lastLoad = Date.now();
    this.saveCache();
    this.status = this.outbox.length ? 'syncing' : 'synced';
    this.emit();
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
        if (this.outbox.some((o) => o.coll === key.coll && o.id === key.id)) return;
        if (p.eventType === 'DELETE') { if (this.docs[key.coll]) delete this.docs[key.coll][key.id]; }
        else (this.docs[row.coll] ||= {})[row.id] = row.data;
        this.saveCache();
        this.emit();
      })
      .subscribe();
  }

  stop() { if (this.channel) { this.sb.removeChannel(this.channel); this.channel = null; } }
}
