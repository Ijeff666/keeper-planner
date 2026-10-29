import { html, useState, useEffect, useRef, useMemo } from './lib.js';
import { CATS, MUSCLES, e1rm, fmtDate, fmtRange, guessMuscle, isTraining, parseRx, partNoteFor, programWeek, rxFor, debounce, todayKey, uid } from './util.js';
import { Icon, Btn, Sheet, Scale, Segmented, Field, Empty, toast, restTimer } from './ui.js';
import { ls } from './store.js';
import * as M from './model.js';

const STATUS = { done: 'Done', partial: 'Partial', skipped: 'Skipped' };
const LOGGABLE = ['gym', 'plyo'];

export function weekFor(program, date) {
  const pw = programWeek(program, date);
  if (!pw) return { wk: 1, pw: null };
  if (pw.before) return { wk: 1, pw };
  if (pw.after) return { wk: program.weeks, pw };
  return { wk: pw.wk, pw };
}

export function BlockSheet({ store, date, blockId, onClose, actions }) {
  const day = M.getDay(store, date);
  const block = day.blocks.find((b) => b.id === blockId);
  useEffect(() => { if (!block) onClose(); }, [block]);
  if (!block) return null;
  const session = M.getSession(store, block.sessionId);
  const program = M.getProgram(store);
  const { wk, pw } = weekFor(program, date);
  const entry = M.blockLog(store, date, block.id);
  const train = isTraining(block.cat);
  const tracked = M.isTracked(block);
  const canLog = !!session || LOGGABLE.includes(block.cat) || !!entry?.extra?.length;
  const sum = entry?.items ? M.entrySummary(store, entry) : null;

  return html`<${Sheet} open title=${block.title} onClose=${onClose} class=${`block-sheet cat-${block.cat}`}
      footer=${html`
        <${Btn} kind="quiet" icon="edit" onClick=${() => actions.editBlock(date, block.id)}>Edit</${Btn}>
        <span class="grow"></span>
        ${tracked && html`<${StatusButtons} store=${store} date=${date} block=${block} status=${entry?.status} />`}
        ${canLog && html`<${Btn} kind="primary" icon="play" onClick=${() => actions.openWorkout(date, block.id)}>${entry?.items ? 'Open log' : session ? 'Start' : 'Log sets'}</${Btn}>`}`}>
    <div class="bs-meta">
      <span class=${`cat-pill on cat-${block.cat}`}>${CATS[block.cat]?.short}</span>
      <span>${fmtDate(date)} · ${fmtRange(block.start, block.end)}</span>
      ${block.location && html`<span><${Icon} name="pin" size=${14} /> ${block.location}</span>`}
      ${pw && !pw.before && !pw.after && html`<span class=${`wk-chip sm ${pw.deload ? 'deload' : ''}`}>${pw.label}</span>`}
      ${entry?.status && html`<span class=${`status-pill st-${entry.status}`}>${STATUS[entry.status]}${entry.rpe ? ` · RPE ${entry.rpe}` : ''}</span>`}
    </div>
    ${block.remind != null && html`<p class="muted small"><${Icon} name="bell" size=${14} /> Reminder ${block.remind === 0 ? 'at start' : `${block.remind} min before`}${block.remindNote ? ` · ${block.remindNote}` : ''}</p>`}
    ${day.note && html`<div class="callout"><b>Today:</b> ${day.note}</div>`}
    ${block.note && html`<div class="callout"><b>This block:</b> ${block.note}</div>`}
    ${entry?.note && html`<div class="callout logged"><b>Your note:</b> ${entry.note}</div>`}
    ${sum?.sets > 0 && html`<p class="logged-sum"><${Icon} name="dumbbell" size=${16} /> ${sum.sets} sets logged${sum.vol ? ` · ${Math.round(sum.vol).toLocaleString()} ${M.getSettings(store).units || 'lb'} volume` : ''}${entry.finishedAt && entry.startedAt ? ` · ${Math.round((new Date(entry.finishedAt) - new Date(entry.startedAt)) / 60000)} min` : ''}</p>`}
    ${session ? html`<${SessionPlan} session=${session} wk=${wk} />`
      : canLog ? html`<p class="muted">No preset on this block. Tap <b>Log sets</b> and add exercises as you go.</p>`
      : !train && html`<p class="muted">Life block. Edit it to change the time or add a reminder.</p>`}
  </${Sheet}>`;
}

export function SessionPlan({ session, wk }) {
  return html`<div class="plan">
    ${session.bring && html`<p class="plan-line"><b>Bring</b> ${session.bring}</p>`}
    ${session.notes && html`<p class="plan-line">${session.notes}</p>`}
    ${session.warmup && html`<p class="plan-line"><b>Warm-up</b> ${session.warmup}</p>`}
    ${(session.parts || []).map((part) => html`<div class="plan-part">
      <h4>${part.name}</h4>
      ${(part.note || partNoteFor(part, wk)) && html`<p class="plan-note">${[partNoteFor(part, wk), part.note].filter(Boolean).join(' · ')}</p>`}
      <ul>${part.items.map((it) => {
        const rx = rxFor(it, wk);
        const skip = parseRx(rx).skip;
        return html`<li class=${skip ? 'muted' : ''}><span class="plan-item">${it.name}</span>${it.kind !== 'check' || it.byWeek ? html`<span class="rx">${skip ? 'not this week' : rx}</span>` : ''}
          ${it.cue && html`<span class="cue">${it.cue}</span>`}</li>`;
      })}</ul>
    </div>`)}
    ${session.cooldown && html`<p class="plan-line"><b>Cooldown</b> ${session.cooldown}</p>`}
  </div>`;
}

// Tapping the current status again clears it, so a mis-tap is one tap to undo.
export function StatusButtons({ store, date, block, status, compact }) {
  const set = (st) => {
    const next = status === st ? null : st;
    M.setStatus(store, date, block, next);
    if (!compact) toast(next ? `${block.title}: ${STATUS[next]}` : `${block.title}: cleared`);
  };
  const b = (st, label, icon) => html`<button type="button" class=${`st-btn st-${st} ${status === st ? 'on' : ''}`} onClick=${() => set(st)}
      aria-pressed=${status === st} title=${STATUS[st]}>${icon ? html`<${Icon} name=${icon} size=${16} />` : ''}${!compact || !icon ? html`<span>${label}</span>` : ''}</button>`;
  return html`<div class=${`st-btns ${compact ? 'compact' : ''}`} role="group" aria-label="Status">
    ${b('done', 'Done', 'check')}${b('partial', compact ? '½' : 'Half')}${b('skipped', compact ? 'Skip' : 'Skipped')}
  </div>`;
}

export function LogQueue({ store, items, actions, limit }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!items.length) return html`<p class="muted">All caught up. Every training and study block is logged.</p>`;
  return html`<ul class="queue">
    ${shown.map(({ k, b }) => {
      const canLog = !!b.sessionId || LOGGABLE.includes(b.cat);
      return html`<li class="queue-row" key=${`${k}:${b.id}`}>
        <button type="button" class="queue-what" onClick=${() => actions.openBlock(k, b.id)}>
          <span class=${`dot cat-${b.cat}`}></span>
          <span class="queue-title">${b.title}</span>
          <span class="queue-when">${k === todayKey() ? 'Today' : fmtDate(k, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtRange(b.start, b.end)}</span>
        </button>
        <span class="queue-acts">
          ${canLog && html`<button type="button" class="st-btn" onClick=${() => actions.openWorkout(k, b.id)} title="Log sets"><${Icon} name="dumbbell" size=${16} /></button>`}
          <${StatusButtons} store=${store} date=${k} block=${b} compact />
        </span>
      </li>`;
    })}
    ${limit && items.length > limit && html`<li class="queue-more"><button type="button" class="btn btn-quiet btn-sm" onClick=${actions.openQueue}>See all ${items.length}</button></li>`}
  </ul>`;
}

export function LogQueueSheet({ store, onClose, actions, today, nowM }) {
  const items = M.toLog(store, today, nowM, 28);
  const markAll = (status) => {
    for (const { k, b } of items) M.setStatus(store, k, b, status);
    toast(`Marked ${items.length} block${items.length === 1 ? '' : 's'} ${STATUS[status].toLowerCase()}`);
  };
  return html`<${Sheet} open title="To log" onClose=${onClose}
      footer=${items.length > 1 && html`<span class="muted small">${items.length} blocks, last 4 weeks</span><span class="grow"></span>
        <${Btn} kind="quiet" onClick=${() => markAll('skipped')}>All skipped</${Btn}>
        <${Btn} kind="quiet" icon="check" onClick=${() => markAll('done')}>All done</${Btn}>`}>
    <p class="muted small">Training and study blocks that ended without a log. Tap one to see it, or mark it here.</p>
    <${LogQueue} store=${store} items=${items} actions=${actions} />
  </${Sheet}>`;
}

export function DayTrack({ store, date, actions }) {
  const day = M.getDay(store, date);
  const log = M.getLog(store, date);
  const s = M.dayStats(store, date);
  const units = M.getSettings(store).units || 'lb';
  const w = log.wellness || {};
  const tracked = day.blocks.filter(M.isTracked);
  const h = (m) => `${(m / 60).toFixed(m % 60 ? 1 : 0)}h`;
  return html`<div class="day-track">
    <div class="dt-stats">
      <span><b>${s.done + s.partial}</b>/${s.planned} logged</span>
      ${s.trainPlan > 0 && html`<span>Training <b>${h(s.trainDone)}</b> of ${h(s.trainPlan)}</span>`}
      ${s.studyPlan > 0 && html`<span>Study <b>${h(s.studyDone)}</b> of ${h(s.studyPlan)}</span>`}
      ${w.sleep != null && html`<span>Sleep <b>${w.sleep}h</b></span>`}
      ${w.energy && html`<span>Energy <b>${w.energy}</b>/5</span>`}
      ${w.water != null && html`<span>Water <b>${w.water}</b> cups</span>`}
      ${w.weight && html`<span>Weight <b>${w.weight}</b> ${units}</span>`}
    </div>
    ${tracked.length ? html`<ul class="queue">
      ${tracked.map((b) => {
        const entry = log.blocks?.[b.id];
        const sum = entry?.items ? M.entrySummary(store, entry) : null;
        return html`<li class="queue-row" key=${b.id}>
          <button type="button" class="queue-what" onClick=${() => actions.openBlock(date, b.id)}>
            <span class=${`dot cat-${b.cat}`}></span>
            <span class="queue-title">${b.title}</span>
            <span class="queue-when">${fmtRange(b.start, b.end)}${sum?.sets ? ` · ${sum.sets} sets` : ''}${entry?.rpe ? ` · RPE ${entry.rpe}` : ''}</span>
          </button>
          <span class="queue-acts"><${StatusButtons} store=${store} date=${date} block=${b} status=${entry?.status} compact /></span>
        </li>`;
      })}
    </ul>` : html`<p class="muted small">No training or study planned.</p>`}
  </div>`;
}

// Two ways to log the same data: Focus (one set at a time, big buttons, for the gym floor) and List (everything at once).

const isSetRow = (row) => row.kind !== 'check' && !!row.p.sets;
const doneOf = (row) => (row.log?.sets || []).filter((s) => s.done);

// Pre-fill for set i: what's already typed, then this session's previous set, then the plan, then last time.
function setDefaults(row, i) {
  const sets = row.log?.sets || [];
  const s = sets[i] || {};
  const prev = sets.slice(0, i).reverse().find((x) => x.done);
  const lastSets = (row.last?.sets || []).filter((x) => x.done);
  const lastSame = lastSets[i] || lastSets[lastSets.length - 1];
  return {
    w: s.w ?? prev?.w ?? lastSame?.w ?? row.it.weight ?? null,
    r: s.r ?? row.p.reps ?? prev?.r ?? lastSame?.r ?? null,
    s: s.s ?? row.p.secs ?? prev?.s ?? lastSame?.s ?? null,
  };
}

export function WorkoutView({ store, date, blockId, onBack, onDone }) {
  const day = M.getDay(store, date);
  const block = day.blocks.find((b) => b.id === blockId);
  const session = block && M.getSession(store, block.sessionId);
  const program = M.getProgram(store);
  const units = M.getSettings(store).units || 'lb';
  const { wk, pw } = weekFor(program, date);
  const history = useMemo(() => M.liftHistory(store), []);
  const liftNames = useMemo(() => Object.values(history).map((h) => h.name).sort(), [history]);
  const [mode, setModeState] = useState(() => ls.get('kp:woMode') || 'focus');
  const setMode = (m) => { setModeState(m); ls.set('kp:woMode', m); };
  const [e, setE] = useState(() => {
    const prev = M.blockLog(store, date, blockId);
    return { items: {}, extra: [], rpe: null, note: '', ...(prev || {}), sessionId: block?.sessionId || null, title: block?.title, cat: block?.cat,
      plannedMin: block ? M.trainingMinutes([block]) : 0, startedAt: prev?.startedAt || new Date().toISOString() };
  });
  const first = useRef(true);
  const dirty = useRef(false);
  const eRef = useRef(e);
  eRef.current = e;
  const persist = useRef(debounce((v) => M.setBlockLog(store, date, blockId, v), 600)).current;
  const lastCache = useRef({});

  useEffect(() => { if (first.current) { first.current = false; return; } dirty.current = true; persist(e); }, [e]);
  useEffect(() => () => { if (dirty.current) persist.flush(eRef.current); }, []);

  useEffect(() => {
    let lock = null;
    const req = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ } };
    req();
    const vis = () => { if (document.visibilityState === 'visible') req(); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release?.().catch(() => {}); };
  }, []);

  if (!block) {
    return html`<section class="wo-page"><${Empty} title="That workout is gone" action=${html`<${Btn} kind="primary" onClick=${() => onDone(null)}>Back to Gym</${Btn}>`}>
      The block was moved or deleted from the calendar.</${Empty}></section>`;
  }

  const setRaw = (id, patch) => setE((x) => ({ ...x, items: { ...x.items, [id]: { ...(x.items[id] || {}), ...patch } } }));
  const setItem = (row, patch) => setRaw(row.id, { ...row.meta, ...patch });

  const makeRow = (it, part, extra) => {
    const log = e.items[it.id];
    const name = log?.swap || it.name;
    const rx = extra ? it.rx || '' : rxFor(it, wk);
    const load = extra ? it.load !== false : !!it.load;
    const ck = `${it.id}|${name}`;
    lastCache.current[ck] ||= {
      last: load || log?.swap || extra ? M.lastItemLog(store, extra ? null : block.sessionId, it.id, date, name) : null,
      best: M.bestBefore(history, name, date),
    };
    return { id: it.id, it, name, extra, rx, p: parseRx(rx), log, load, kind: it.kind || 'reps', rest: it.rest || part?.rest || 90,
      swapped: !!log?.swap, meta: { name: it.name, muscle: it.muscle || guessMuscle(it.name) }, ...lastCache.current[ck] };
  };
  const parts = [
    ...(session?.parts || []).map((part) => ({ name: part.name, note: [partNoteFor(part, wk), part.note].filter(Boolean).join(' · '), rows: part.items.map((it) => makeRow(it, part)) })),
    ...(e.extra?.length ? [{ name: session ? 'Added today' : 'Exercises', rows: e.extra.map((x) => makeRow(x, null, true)) }] : []),
  ];

  const logSet = (row, i, vals, { rest = true } = {}) => {
    const sets = row.log?.sets?.length ? [...row.log.sets] : Array.from({ length: row.p.sets || 1 }, () => ({}));
    while (sets.length <= i) sets.push({});
    sets[i] = { ...sets[i], ...vals, done: true };
    setItem(row, { sets });
    if (row.load && vals.w && vals.r) {
      const est = e1rm(vals.w, vals.r);
      const before = Math.max(row.best.e1rm, ...doneOf(row).filter((_, j) => j !== i).map((s) => e1rm(s.w, s.r)));
      if (row.best.e1rm > 0 && est > before) toast(`New PR on ${row.name}: ${vals.w} × ${vals.r} (est. 1RM ${est} ${units})`, { ms: 5000 });
      else if (row.best.w > 0 && vals.w > Math.max(row.best.w, ...doneOf(row).filter((_, j) => j !== i).map((s) => s.w || 0))) toast(`Heaviest ${row.name} yet: ${vals.w} ${units}`, { ms: 4000 });
    }
    if (rest) restTimer(row.rest, row.name);
  };
  const unsetSet = (row, i) => setItem(row, { sets: (row.log?.sets || []).map((s, j) => (j === i ? { ...s, done: false } : s)) });
  const addExtra = (x) => setE((v) => ({ ...v, extra: [...(v.extra || []), x] }));
  const removeExtra = (id) => setE((v) => { const items = { ...v.items }; delete items[id]; return { ...v, extra: v.extra.filter((x) => x.id !== id), items }; });

  const finish = (status) => {
    const v = { ...e, status, finishedAt: new Date().toISOString() };
    // The view unmounts before setE re-renders, so the unmount flush would otherwise write the pre-finish copy.
    eRef.current = v;
    dirty.current = false;
    persist.flush(v);
    onDone(status);
  };

  let total = 0, done = 0;
  for (const part of parts) for (const row of part.rows) {
    if (row.p.skip) continue;
    if (isSetRow(row)) { const n = Math.max(row.p.sets, row.log?.sets?.length || 0); total += n; done += Math.min(n, doneOf(row).length); }
    else { total += 1; done += row.log?.done ? 1 : 0; }
  }

  const add = html`<${AddExercise} names=${liftNames} units=${units} onAdd=${addExtra} startOpen=${!session && !e.extra?.length} />`;

  return html`<section class=${`wo-page cat-${block.cat}`}>
    <header class="wo-bar">
      <button type="button" class="icon-btn" onClick=${onBack} aria-label="Back to Gym"><${Icon} name="left" /></button>
      <div class="wo-title">
        <h1>${block.title}</h1>
        <span class="meta">${date === todayKey() ? 'Today' : fmtDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}${pw && !pw.before && !pw.after ? ` · ${pw.label}` : ''}</span>
      </div>
      <${Clock} since=${e.startedAt} />
      <${Btn} kind="primary" onClick=${() => finish('done')}>Finish</${Btn}>
    </header>
    <div class="wo-head">
      <span class="wo-progress"><span style=${`width:${total ? (done / total) * 100 : 0}%`}></span></span>
      <span class="muted small">${done}/${total} sets</span>
      <${Segmented} label="Logging view" value=${mode} onChange=${setMode} options=${[['focus', 'Focus'], ['list', 'List']]} />
    </div>
    ${day.note && html`<div class="callout"><b>Today:</b> ${day.note}</div>`}
    ${block.note && html`<div class="callout"><b>This block:</b> ${block.note}</div>`}
    ${session?.bring && html`<p class="plan-line"><b>Bring</b> ${session.bring}</p>`}
    ${session?.warmup && html`<${CheckRow} label="Warm-up" text=${session.warmup} done=${e.items._warmup?.done} onToggle=${() => setRaw('_warmup', { done: !e.items._warmup?.done })} />`}

    ${mode === 'focus'
      ? html`<${FocusView} parts=${parts} units=${units} onLog=${logSet} onCheck=${(row, v) => setItem(row, { done: v })}
          onSwap=${(row, swap) => setItem(row, { swap })} onFinish=${() => finish('done')} add=${add} />`
      : html`
        ${session?.notes && html`<p class="plan-line">${session.notes}</p>`}
        ${parts.map((part) => html`<section class="wo-part">
          <h3>${part.name}</h3>
          ${part.note && html`<p class="plan-note">${part.note}</p>`}
          ${part.rows.map((row) => html`<${ItemLog} key=${row.id} row=${row} units=${units}
              onChange=${(patch) => setItem(row, patch)} onLog=${logSet} onUnset=${unsetSet} onRemove=${row.extra ? () => removeExtra(row.id) : null} />`)}
        </section>`)}
        ${add}`}

    ${session?.cooldown && html`<${CheckRow} label="Cooldown" text=${session.cooldown} done=${e.items._cooldown?.done} onToggle=${() => setRaw('_cooldown', { done: !e.items._cooldown?.done })} />`}
    <div class="card wo-end">
      <div class="wo-rpe"><span class="field-label">Effort (RPE)</span><${Scale} label="RPE" max=${10} value=${e.rpe} onChange=${(rpe) => setE((x) => ({ ...x, rpe }))} /></div>
      <label class="field"><span class="field-label">Note</span>
        <textarea rows="2" value=${e.note || ''} onInput=${(ev) => setE((x) => ({ ...x, note: ev.target.value }))}
          placeholder="How did it go? Anything that hurt?"></textarea>
      </label>
      <div class="wo-actions">
        <${Btn} kind="quiet" onClick=${() => finish('skipped')}>Skipped</${Btn}>
        <${Btn} kind="quiet" onClick=${() => finish('partial')}>Partial</${Btn}>
        <${Btn} kind="primary" icon="check" onClick=${() => finish('done')}>Finish workout</${Btn}>
      </div>
    </div>
  </section>`;
}

// Ticks on its own so the rest of the logger doesn't re-render every second.
function Clock({ since }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const s = Math.max(0, Math.floor((Date.now() - new Date(since)) / 1000));
  return html`<span class="wo-clock" aria-label="Elapsed time">${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span>`;
}

function CheckRow({ label, text, done, onToggle }) {
  return html`<button type="button" class=${`check-row ${done ? 'on' : ''}`} onClick=${onToggle} aria-pressed=${!!done}>
    <span class="tick">${done && html`<${Icon} name="check" size=${16} />`}</span>
    <span><b>${label}</b> ${text}</span>
  </button>`;
}

const lastLine = (row) => {
  const sets = (row.last?.sets || []).filter((s) => s.done);
  if (!sets.length) return null;
  const fmt = (s) => (row.kind === 'time' ? `${s.s ?? '–'}s` : row.load ? `${s.w ?? '–'}×${s.r ?? '–'}` : `${s.r ?? '–'}`);
  return `Last time (${fmtDate(row.last.date, { month: 'short', day: 'numeric' })}): ${sets.map(fmt).join(', ')}`;
};
const isPR = (row, s) => row.load && s.done && row.best.e1rm > 0 && e1rm(s.w, s.r) > row.best.e1rm;
const overload = (row) => {
  if (!row.load || !row.last) return false;
  const top = (sets) => Math.max(0, ...sets.filter((s) => s.done).map((s) => e1rm(s.w, s.r) || s.w || 0));
  const now = top(row.log?.sets || []);
  return now > 0 && now > top(row.last.sets || []);
};

function SwapPicker({ row, onPick }) {
  const [custom, setCustom] = useState('');
  return html`<div class="swap">
    <p class="muted small">Machine taken or something hurts? Swap it for today. The plan stays the same.</p>
    <div class="chip-row">
      ${row.swapped && html`<button type="button" class="chip" onClick=${() => onPick(null)}>Back to ${row.it.name}</button>`}
      ${(row.it.alts || []).map((a) => html`<button type="button" class=${`chip ${row.name === a ? 'on' : ''}`} onClick=${() => onPick(a)}>${a}</button>`)}
    </div>
    <form class="swap-custom" onSubmit=${(ev) => { ev.preventDefault(); if (custom.trim()) onPick(custom.trim()); }}>
      <input value=${custom} onInput=${(ev) => setCustom(ev.target.value)} placeholder="Something else" aria-label="Exercise to swap in" />
      <${Btn} kind="quiet" type="submit" disabled=${!custom.trim()}>Swap</${Btn}>
    </form>
  </div>`;
}

function ItemLog({ row, units, onChange, onLog, onUnset, onRemove }) {
  const [swapping, setSwapping] = useState(false);
  const { p, it } = row;
  if (p.skip) return html`<div class="item muted"><div class="item-head"><span class="item-name">${row.name}</span><span class="rx">not this week</span></div></div>`;
  if (!isSetRow(row)) {
    return html`<${CheckRow} label=${row.name} text=${[row.rx && (it.byWeek || row.extra) ? row.rx : '', it.cue].filter(Boolean).join(' · ')} done=${row.log?.done} onToggle=${() => onChange({ done: !row.log?.done })} />`;
  }
  const sets = row.log?.sets?.length ? row.log.sets : Array.from({ length: p.sets }, () => ({}));
  const setAt = (i, patch) => onChange({ sets: sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const toggle = (i) => {
    if (sets[i].done) return onUnset(row, i);
    const d = setDefaults(row, i);
    onLog(row, i, row.kind === 'time' ? { s: d.s, ...(row.load ? { w: d.w } : {}) } : { r: d.r, ...(row.load ? { w: d.w } : {}) });
  };
  const lastW = (row.last?.sets || []).filter((s) => s.done && s.w).map((s) => s.w);
  const unit = row.kind === 'time' ? 'sec' : 'reps';
  return html`<div class="item">
    <div class="item-head">
      <span class="item-name">${row.name}${overload(row) && html` <span class="badge up" title="Beat last time">↑ vs last</span>`}</span>
      <span class="rx">${row.rx}</span>
    </div>
    ${row.swapped && html`<p class="muted small">Swapped in for ${it.name}</p>`}
    ${it.cue && html`<p class="cue">${it.cue}</p>`}
    ${lastLine(row) && html`<p class="last">${lastLine(row)}</p>`}
    <div class="sets">
      ${sets.map((s, i) => html`<div class=${`set ${s.done ? 'on' : ''}`}>
        <span class="set-n">${i + 1}${p.perSide ? html`<small>/side</small>` : ''}</span>
        ${row.load && html`<label class="set-in"><input type="number" inputmode="decimal" step="2.5" min="0" value=${s.w ?? ''}
            placeholder=${lastW[i] ?? lastW[lastW.length - 1] ?? units} onChange=${(ev) => setAt(i, { w: ev.target.value === '' ? null : +ev.target.value })} aria-label=${`Set ${i + 1} weight`} /><span>${units}</span></label>`}
        <label class="set-in"><input type="number" inputmode="numeric" min="0" value=${(row.kind === 'time' ? s.s : s.r) ?? ''}
            placeholder=${(row.kind === 'time' ? p.secs : p.reps) ?? '–'}
            onChange=${(ev) => setAt(i, row.kind === 'time' ? { s: ev.target.value === '' ? null : +ev.target.value } : { r: ev.target.value === '' ? null : +ev.target.value })}
            aria-label=${`Set ${i + 1} ${unit}`} /><span>${unit}</span></label>
        ${isPR(row, s) ? html`<span class="badge pr">PR</span>` : ''}
        <button type="button" class="set-done" onClick=${() => toggle(i)} aria-pressed=${!!s.done} aria-label=${`Set ${i + 1} done`}><${Icon} name="check" size=${18} /></button>
      </div>`)}
      <div class="item-tools">
        <button type="button" class="set-add" onClick=${() => onChange({ sets: [...sets, {}] })}>+ Set</button>
        ${!row.extra && html`<button type="button" class="set-add" onClick=${() => setSwapping((v) => !v)}><${Icon} name="repeat" size=${14} /> Swap</button>`}
        ${onRemove && html`<button type="button" class="set-add danger" onClick=${onRemove}><${Icon} name="trash" size=${14} /> Remove</button>`}
      </div>
    </div>
    ${swapping && html`<${SwapPicker} row=${row} onPick=${(n) => { onChange({ swap: n }); setSwapping(false); }} />`}
    ${row.kind === 'count' && html`<div class="quality"><span class="muted small">How clean were the reps?</span>
      <${Scale} label="Quality" value=${row.log?.q} onChange=${(q) => onChange({ q })} labels=${['Sloppy', 'Rough', 'OK', 'Good', 'Sharp']} /></div>`}
  </div>`;
}

function FocusView({ parts, units, onLog, onCheck, onSwap, onFinish, add }) {
  const steps = [];
  for (const part of parts) for (const row of part.rows) {
    if (row.p.skip) continue;
    if (!isSetRow(row)) steps.push({ row, part, i: -1 });
    else { const n = Math.max(row.p.sets, row.log?.sets?.length || 0); for (let i = 0; i < n; i++) steps.push({ row, part, i, n }); }
  }
  const isDone = (st) => (st.i < 0 ? !!st.row.log?.done : !!st.row.log?.sets?.[st.i]?.done);
  const nextOpen = (from) => {
    for (let k = from; k < steps.length; k++) if (!isDone(steps[k])) return k;
    for (let k = 0; k < from; k++) if (!isDone(steps[k])) return k;
    return steps.length;
  };
  const [pos, setPos] = useState(() => nextOpen(0));
  const st = steps[Math.min(pos, steps.length)];
  const rows = parts.flatMap((p) => p.rows.filter((r) => !r.p.skip));

  if (!steps.length) return html`<div class="focus">${add}</div>`;

  if (!st) {
    const prs = rows.reduce((n, r) => n + (r.log?.sets || []).filter((s) => isPR(r, s)).length, 0);
    return html`<div class="focus">
      <div class="card focus-card focus-done">
        <h3>Every set is in</h3>
        <p>${steps.filter(isDone).length} of ${steps.length} done${prs ? ` · ${prs} PR${prs > 1 ? 's' : ''}` : ''}. Rate the effort below, then finish.</p>
        <div class="next-actions"><${Btn} kind="primary" icon="check" onClick=${onFinish}>Finish workout</${Btn}><${Btn} kind="quiet" onClick=${() => setPos(0)}>Review sets</${Btn}></div>
      </div>
      ${add}
    </div>`;
  }

  const advance = () => { const k = nextOpen(pos + 1); setPos(k === pos ? steps.length : k); };
  const skipExercise = () => {
    let k = pos;
    while (k < steps.length && steps[k].row === st.row) k++;
    setPos(k < steps.length ? k : nextOpen(0) === pos ? steps.length : nextOpen(0));
  };
  const nextStep = steps.slice(pos + 1).find((s) => !isDone(s));
  const exNo = rows.indexOf(st.row) + 1;

  return html`<div class="focus">
    <p class="focus-ctx">Exercise <b>${exNo}</b> of ${rows.length} · ${st.part.name}</p>
    <${FocusStep} key=${`${st.row.id}:${st.i}:${st.row.name}`} st=${st} units=${units} done=${isDone(st)}
      onLog=${(vals) => { onLog(st.row, st.i, vals, { rest: !!nextStep }); advance(); }}
      onCheck=${() => { onCheck(st.row, !st.row.log?.done); if (!st.row.log?.done) advance(); }}
      onSwap=${(n) => onSwap(st.row, n)} />
    <div class="focus-nav">
      <${Btn} kind="quiet" icon="left" onClick=${() => setPos(Math.max(0, pos - 1))} disabled=${pos === 0}>Back</${Btn}>
      <${Btn} kind="quiet" onClick=${skipExercise}>Skip exercise</${Btn}>
      <${Btn} kind="quiet" onClick=${() => setPos(Math.min(steps.length - 1, pos + 1))} disabled=${pos >= steps.length - 1}>Next<${Icon} name="right" size=${18} /></${Btn}>
    </div>
    ${nextStep && html`<p class="up-next">Up next: <b>${nextStep.row.name}</b>${nextStep.i >= 0 ? ` · set ${nextStep.i + 1}` : ''}</p>`}
    ${add}
  </div>`;
}

function FocusStep({ st, units, done, onLog, onCheck, onSwap }) {
  const { row, i, n } = st;
  const [d, setD] = useState(() => setDefaults(row, Math.max(0, i)));
  const [swapping, setSwapping] = useState(false);
  const wStep = units === 'kg' ? 2.5 : 5;
  const est = row.load ? e1rm(d.w, d.r) : 0;
  const prPace = row.load && row.best.e1rm > 0 && est > Math.max(row.best.e1rm, ...doneOf(row).map((s) => e1rm(s.w, s.r)));

  return html`<div class=${`card focus-card cat-${row.load ? 'gym' : 'gk'}`}>
    <div class="focus-top">
      <h3>${row.name}</h3>
      ${!row.extra && html`<button type="button" class="icon-btn sm" onClick=${() => setSwapping((v) => !v)} aria-label="Swap exercise" title="Swap exercise"><${Icon} name="repeat" size=${18} /></button>`}
    </div>
    ${row.swapped && html`<p class="muted small">Swapped in for ${row.it.name}</p>`}
    <p class="focus-rx"><span class="rx">${row.rx}</span>${i >= 0 && html`<span>Set <b>${i + 1}</b> of ${n}${row.p.perSide ? ' · each side' : ''}</span>`}${done && html`<span class="status-pill st-done">Logged</span>`}</p>
    ${row.it.cue && html`<p class="cue">${row.it.cue}</p>`}
    ${lastLine(row) && html`<p class="last">${lastLine(row)}</p>`}
    ${swapping && html`<${SwapPicker} row=${row} onPick=${(nm) => { onSwap(nm); setSwapping(false); }} />`}

    ${i < 0
      ? html`<button type="button" class=${`log-set ${row.log?.done ? 'on' : ''}`} onClick=${onCheck}><${Icon} name="check" size=${22} /> ${row.log?.done ? 'Done' : 'Mark done'}</button>`
      : html`
        <div class="focus-inputs">
          ${row.load && html`<${BigNum} label=${`Weight (${units})`} value=${d.w} step=${wStep} chips=${[-2 * wStep, -wStep, wStep, 2 * wStep]} onChange=${(w) => setD((x) => ({ ...x, w }))} />`}
          ${row.kind === 'time'
            ? html`<${BigNum} label="Seconds" value=${d.s} step=${5} onChange=${(s) => setD((x) => ({ ...x, s }))} />`
            : html`<${BigNum} label=${row.kind === 'count' ? 'Reps (clean)' : 'Reps'} value=${d.r} step=${1} chips=${[-2, -1, 1, 2]} onChange=${(r) => setD((x) => ({ ...x, r }))} />`}
        </div>
        ${row.load && est > 0 && html`<p class=${`est ${prPace ? 'pr' : ''}`}>${prPace ? 'New PR if you hit it · ' : ''}est. 1RM ${est} ${units}</p>`}
        <button type="button" class="log-set" onClick=${() => onLog(row.kind === 'time' ? { s: d.s, ...(row.load ? { w: d.w } : {}) } : { r: d.r, ...(row.load ? { w: d.w } : {}) })}>
          <${Icon} name="check" size=${22} /> ${done ? 'Update set' : 'Log set'} ${i + 1}
        </button>`}
  </div>`;
}

function BigNum({ label, value, step, chips, onChange }) {
  const set = (v) => onChange(Math.max(0, Math.round(v * 100) / 100));
  return html`<div class="bignum">
    <span class="field-label">${label}</span>
    <div class="bignum-row">
      <button type="button" class="bn-btn" onClick=${() => set((+value || 0) - step)} aria-label=${`Less: ${label}`}>−</button>
      <input type="number" inputmode="decimal" min="0" value=${value ?? ''} placeholder="–" aria-label=${label}
        onInput=${(ev) => onChange(ev.target.value === '' ? null : +ev.target.value)} />
      <button type="button" class="bn-btn" onClick=${() => set((+value || 0) + step)} aria-label=${`More: ${label}`}>+</button>
    </div>
    ${chips && html`<div class="bn-chips">${chips.map((c) => html`<button type="button" onClick=${() => set((+value || 0) + c)}>${c > 0 ? `+${c}` : c}</button>`)}</div>`}
  </div>`;
}

function AddExercise({ names, onAdd, startOpen }) {
  const [open, setOpen] = useState(!!startOpen);
  const [name, setName] = useState('');
  const [rx, setRx] = useState('3x10');
  const [muscle, setMuscle] = useState('');
  if (!open) return html`<button type="button" class="add-ex" onClick=${() => setOpen(true)}><${Icon} name="plus" size=${18} /> Add an exercise</button>`;
  const timed = /sec|min/i.test(rx);
  const submit = (ev) => {
    ev.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: uid('x'), name: name.trim(), rx: rx.trim() || '3x10', kind: timed ? 'time' : 'reps', load: !timed, muscle: muscle || guessMuscle(name) || null });
    setName(''); setMuscle('');
    toast(`Added ${name.trim()}`);
  };
  return html`<form class="card add-ex-form" onSubmit=${submit}>
    <div class="card-head"><h2>Add an exercise</h2><button type="button" class="icon-btn sm" onClick=${() => setOpen(false)} aria-label="Close"><${Icon} name="x" size=${16} /></button></div>
    <${Field} label="Exercise"><input list="kp-lift-names" value=${name} onInput=${(ev) => setName(ev.target.value)} placeholder="e.g. Leg press" data-autofocus /></${Field}>
    <datalist id="kp-lift-names">${names.map((n) => html`<option value=${n} />`)}</datalist>
    <div class="form-grid">
      <${Field} label="Sets × reps" hint="e.g. 3x10, 4x6-8, 3x30 sec"><input value=${rx} onInput=${(ev) => setRx(ev.target.value)} /></${Field}>
      <${Field} label="Muscle">
        <select value=${muscle} onChange=${(ev) => setMuscle(ev.target.value)}>
          <option value="">${guessMuscle(name) ? `Auto: ${guessMuscle(name)}` : 'Auto'}</option>
          ${MUSCLES.map((m) => html`<option value=${m}>${m}</option>`)}
        </select>
      </${Field}>
    </div>
    <div class="row-end"><${Btn} kind="primary" icon="plus" type="submit" disabled=${!name.trim()}>Add</${Btn}></div>
  </form>`;
}
