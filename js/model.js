import {
  CAT_ORDER, DOW, MUSCLES, addDays, dow, durMin, e1rm, fromMin, guessMuscle, isTraining, isValidKey, parseCSV,
  rangeKeys, slug, sortBlocks, startOfWeek, toCSV, toMin, uid,
} from './util.js';
import { SETTINGS, LIFE_PRESETS, blocksForDay } from './seed.js';

export const getSettings = (store) => ({ ...SETTINGS, lifePresets: LIFE_PRESETS, ...(store.get('settings', 'main') || {}) });
export const saveSettings = (store, patch) => store.put('settings', 'main', { ...getSettings(store), ...patch });

// The id comes from the row key: rows Claude writes by SQL carry no id field in their data.
export function getProgram(store) {
  const s = getSettings(store);
  const id = s.activeProgram && store.get('programs', s.activeProgram) ? s.activeProgram : Object.keys(store.all('programs'))[0];
  return id ? { ...store.get('programs', id), id } : null;
}

export function sessionsList(store) {
  return Object.entries(store.all('sessions'))
    .map(([id, s]) => ({ ...s, id }))
    .sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) || a.title.localeCompare(b.title));
}
export const getSession = (store, id) => (id ? store.get('sessions', id) : null);

export function templatesList(store) {
  return Object.entries(store.all('templates')).map(([id, t]) => ({ ...t, id }));
}

export const getDay = (store, k) => store.get('days', k) || { date: k, blocks: [], note: '' };
export const hasDay = (store, k) => !!store.get('days', k);
export const getLog = (store, k) => store.get('logs', k) || { date: k, blocks: {}, wellness: {} };
export const blockLog = (store, k, id) => getLog(store, k).blocks?.[id] || null;

export function saveDay(store, k, patch) {
  const d = getDay(store, k);
  store.put('days', k, { ...d, ...patch, date: k, blocks: sortBlocks(patch.blocks ?? d.blocks) });
}
export function upsertBlock(store, k, block) {
  const d = getDay(store, k);
  saveDay(store, k, { blocks: [...d.blocks.filter((b) => b.id !== block.id), block] });
}
// Moving a block to another day carries its log along, so sets and status stay attached to it.
export function moveBlock(store, from, to, block) {
  if (from === to) return upsertBlock(store, to, block);
  const src = getDay(store, from), dst = getDay(store, to);
  store.putMany([
    ['days', from, { ...src, date: from, blocks: src.blocks.filter((b) => b.id !== block.id) }],
    ['days', to, { ...dst, date: to, blocks: sortBlocks([...dst.blocks.filter((b) => b.id !== block.id), block]) }],
    ...logMoveRows(store, from, to, block.id),
  ]);
}
// A block can also change days without moveBlock (Claude's SQL, another device), leaving its log behind. If both days
// end up with an entry, the newer one is kept so the sets are never counted twice.
function logMoveRows(store, from, to, id) {
  const a = blockLog(store, from, id);
  if (!a || from === to) return [];
  const b = blockLog(store, to, id);
  const lf = getLog(store, from), lt = getLog(store, to);
  const left = { ...(lf.blocks || {}) };
  delete left[id];
  const keep = b && (b.updatedAt || '') > (a.updatedAt || '') ? b : a;
  return [['logs', from, { ...lf, date: from, blocks: left }], ['logs', to, { ...lt, date: to, blocks: { ...(lt.blocks || {}), [id]: keep } }]];
}
export function moveLog(store, from, to, id) {
  const rows = logMoveRows(store, from, to, id);
  if (rows.length) store.putMany(rows);
}

// Removes a workout's log, and its block too when the block only existed for it (started from Gym or Library).
// Returns an undo that puts back just that entry and block.
export function deleteWorkout(store, k, id) {
  const day = getDay(store, k), log = getLog(store, k);
  const block = day.blocks.find((b) => b.id === id);
  const entry = log.blocks?.[id];
  const blocks = { ...(log.blocks || {}) };
  delete blocks[id];
  const dropBlock = !!block?.adhoc;
  store.putMany([
    ...(entry ? [['logs', k, { ...log, date: k, blocks }]] : []),
    ...(dropBlock ? [['days', k, { ...day, date: k, blocks: day.blocks.filter((b) => b.id !== id) }]] : []),
  ]);
  return () => {
    const d = getDay(store, k), l = getLog(store, k);
    store.putMany([
      ...(entry ? [['logs', k, { ...l, date: k, blocks: { ...(l.blocks || {}), [id]: entry } }]] : []),
      ...(dropBlock ? [['days', k, { ...d, date: k, blocks: sortBlocks([...d.blocks.filter((b) => b.id !== id), block]) }]] : []),
    ]);
  };
}
export function removeBlock(store, k, id) {
  const d = getDay(store, k);
  saveDay(store, k, { blocks: d.blocks.filter((b) => b.id !== id) });
}
// One write per day, one re-render.
export function addBlockToDays(store, keys, block) {
  const rows = keys.map((k) => {
    const d = getDay(store, k);
    return ['days', k, { ...d, date: k, blocks: sortBlocks([...d.blocks, { ...block, id: uid() }]) }];
  });
  store.putMany(rows);
}

export function setBlockLog(store, k, blockId, entry) {
  const log = getLog(store, k);
  const blocks = { ...(log.blocks || {}) };
  if (entry == null) delete blocks[blockId];
  else blocks[blockId] = { ...entry, updatedAt: new Date().toISOString() };
  store.put('logs', k, { ...log, date: k, blocks });
}
export function setWellness(store, k, patch) {
  const log = getLog(store, k);
  store.put('logs', k, { ...log, date: k, wellness: { ...(log.wellness || {}), ...patch } });
}

export function blockFromSession(ses, settings, startMin) {
  const start = startMin ?? 16 * 60;
  return {
    id: uid(), title: ses.title, cat: ses.cat, sessionId: ses.id, location: ses.location || '',
    start: fromMin(start), end: fromMin(Math.min(1440, start + (ses.duration || 60))),
    remind: ses.remind ?? (isTraining(ses.cat) ? settings.remindDefault ?? 30 : null), remindNote: ses.remindNote || '',
  };
}
export function blockFromLife(p, startMin) {
  const start = startMin ?? 15 * 60;
  return { id: uid(), title: p.title, cat: p.cat, start: fromMin(start), end: fromMin(Math.min(1440, start + (p.dur || 60))), remind: null };
}

// Fill days from a template. mode 'empty' skips days that already have blocks;
// 'replace' swaps in the template but keeps any block that already has a log entry.
export function applyTemplate(store, tpl, keys, { mode = 'empty', weekdays } = {}) {
  const rows = [];
  for (const k of keys) {
    if (weekdays && !weekdays.includes(DOW[dow(k)])) continue;
    const d = getDay(store, k);
    if (mode === 'empty' && d.blocks.length) continue;
    const log = getLog(store, k);
    const kept = mode === 'replace' ? d.blocks.filter((b) => log.blocks?.[b.id]) : d.blocks;
    rows.push(['days', k, { ...d, date: k, template: tpl.id, blocks: sortBlocks([...kept, ...blocksForDay(tpl, k)]) }]);
  }
  if (rows.length) store.putMany(rows);
  return rows.length;
}

export function weekToTemplate(store, weekKeys, base = {}) {
  const days = {};
  for (const k of weekKeys) {
    days[DOW[dow(k)]] = getDay(store, k).blocks.map(({ id, ...b }) => b);
  }
  return { ...base, days };
}

// Item logs carry their own name and muscle, so history survives swaps, added exercises and session edits.

const doneSets = (l) => (l?.sets || []).filter((s) => s.done);

export function entryItems(store, entry) {
  const out = [];
  const ses = getSession(store, entry.sessionId);
  for (const part of ses?.parts || []) for (const it of part.items) {
    const l = entry.items?.[it.id];
    if (!l) continue;
    const name = l.swap || l.name || it.name;
    out.push({ id: it.id, name, muscle: l.muscle || it.muscle || guessMuscle(name), load: !!it.load, kind: it.kind, log: l });
  }
  for (const x of entry.extra || []) {
    const l = entry.items?.[x.id];
    if (l) out.push({ id: x.id, name: x.name, muscle: x.muscle || guessMuscle(x.name), load: x.load !== false, kind: x.kind || 'reps', log: l });
  }
  return out;
}

// Session item first, then by name, so swapped-in and added exercises still find their history.
export function lastItemLog(store, sessionId, itemId, beforeKey, name) {
  const want = name && slug(name);
  const keys = Object.keys(store.all('logs')).filter((k) => k < beforeKey).sort().reverse();
  for (const k of keys) {
    const entries = Object.values(store.get('logs', k).blocks || {});
    for (const entry of entries) {
      const l = entry.items?.[itemId];
      if (sessionId && entry.sessionId === sessionId && !l?.swap && doneSets(l).length) return { date: k, ...l };
    }
    if (want) for (const entry of entries) {
      const x = entryItems(store, entry).find((y) => slug(y.name) === want && doneSets(y.log).length);
      if (x) return { date: k, ...x.log };
    }
  }
  return null;
}

export function liftHistory(store) {
  const out = {};
  for (const [k, log] of Object.entries(store.all('logs'))) {
    for (const entry of Object.values(log.blocks || {})) for (const x of entryItems(store, entry)) {
      const sets = doneSets(x.log).filter((s) => s.w > 0);
      if (!sets.length) continue;
      const top = sets.reduce((a, s) => (s.w > a.w || (s.w === a.w && (s.r || 0) > (a.r || 0)) ? s : a));
      const p = { k, w: top.w, r: top.r, e1rm: Math.max(...sets.map((s) => e1rm(s.w, s.r))), vol: sets.reduce((n, s) => n + s.w * (s.r || 0), 0) };
      const lift = (out[slug(x.name)] ||= { key: slug(x.name), name: x.name, muscle: x.muscle, points: [] });
      const same = lift.points.find((q) => q.k === k);
      if (!same) lift.points.push(p);
      else Object.assign(same, { w: Math.max(same.w, p.w), r: p.w > same.w ? p.r : same.r, e1rm: Math.max(same.e1rm, p.e1rm), vol: same.vol + p.vol });
    }
  }
  for (const v of Object.values(out)) {
    v.points.sort((a, b) => (a.k < b.k ? -1 : 1));
    v.pr = v.points.reduce((a, p) => (p.e1rm > (a?.e1rm || 0) ? p : a), null);
    v.heaviest = v.points.reduce((a, p) => (p.w > (a?.w || 0) ? p : a), null);
  }
  return out;
}

export function bestBefore(history, name, beforeKey) {
  const pts = (history[slug(name)]?.points || []).filter((p) => p.k < beforeKey);
  return { e1rm: Math.max(0, ...pts.map((p) => p.e1rm)), w: Math.max(0, ...pts.map((p) => p.w)) };
}

export function muscleSets(store, from, to) {
  const sets = {}, last = {};
  for (const [k, log] of Object.entries(store.all('logs'))) {
    if (k > to) continue;
    for (const entry of Object.values(log.blocks || {})) for (const x of entryItems(store, entry)) {
      const n = doneSets(x.log).length;
      if (!x.muscle || !n) continue;
      if (k >= from) sets[x.muscle] = (sets[x.muscle] || 0) + n;
      if (!last[x.muscle] || k > last[x.muscle]) last[x.muscle] = k;
    }
  }
  return { sets, last };
}

// The current week counts once anything is logged, so a fresh Monday doesn't break the streak.
export function weekStreak(store, today, weekStart = 1) {
  const hit = new Set();
  for (const [k, log] of Object.entries(store.all('logs'))) {
    if (Object.values(log.blocks || {}).some((e) => ['done', 'partial'].includes(e.status) && (!e.cat || isTraining(e.cat)))) hit.add(k);
  }
  let n = 0;
  const ws = startOfWeek(today, weekStart);
  for (let i = 0; i < 260; i++) {
    const from = addDays(ws, -7 * i);
    if (rangeKeys(from, addDays(from, 6)).some((k) => hit.has(k))) n++;
    else if (i > 0) break;
  }
  return n;
}

export function quickWorkout(store, k, nowM) {
  const start = Math.min(23 * 60, Math.floor(nowM / 15) * 15);
  const block = { id: uid(), title: 'Workout', cat: 'gym', start: fromMin(start), end: fromMin(Math.min(1440, start + 60)), remind: null, adhoc: true };
  upsertBlock(store, k, block);
  return block.id;
}

// Uses today's planned block for this session if it isn't logged yet, so starting early never makes a duplicate.
export function startWorkout(store, k, nowM, sessionId) {
  if (!sessionId) return quickWorkout(store, k, nowM);
  const log = getLog(store, k);
  const planned = sortBlocks(getDay(store, k).blocks).find((b) => b.sessionId === sessionId && !log.blocks?.[b.id]?.status);
  if (planned) return planned.id;
  const ses = getSession(store, sessionId);
  const block = { ...blockFromSession({ ...ses, id: sessionId }, getSettings(store), Math.min(23 * 60, Math.floor(nowM / 15) * 15)), remind: null, adhoc: true };
  upsertBlock(store, k, block);
  return block.id;
}

export const isGymSession = (s) => ['gym', 'plyo'].includes(s.cat) || !!s.gym;

// A workout is an entry with done sets; a block that was only marked done (study, practice) is not one.
export function workoutHistory(store, limit = 20) {
  const out = [];
  for (const k of Object.keys(store.all('logs')).sort().reverse()) {
    for (const [blockId, entry] of Object.entries(store.get('logs', k).blocks || {})) {
      const sum = entrySummary(store, entry);
      if (sum.sets) out.push({ k, blockId, entry, ...sum, items: entryItems(store, entry).filter((x) => doneSets(x.log).length) });
    }
    if (out.length >= limit) break;
  }
  return out;
}

export function lastDone(store, sessionId) {
  for (const k of Object.keys(store.all('logs')).sort().reverse()) {
    if (Object.values(store.get('logs', k).blocks || {}).some((e) => e.sessionId === sessionId && e.status === 'done')) return k;
  }
  return null;
}

export function setsCSV(store) {
  const rows = [['Date', 'Session', 'Exercise', 'Muscle', 'Set', 'Weight', 'Reps', 'Seconds', 'Est 1RM', 'Status', 'RPE']];
  for (const k of Object.keys(store.all('logs')).sort()) {
    for (const entry of Object.values(store.get('logs', k).blocks || {})) for (const x of entryItems(store, entry)) {
      doneSets(x.log).forEach((s, i) => rows.push([k, entry.title || '', x.name, x.muscle || '', i + 1, s.w ?? '', s.r ?? '', s.s ?? '', e1rm(s.w, s.r) || '', entry.status || '', entry.rpe ?? '']));
    }
  }
  return toCSV(rows);
}

export function inboxNotes(store) {
  const ib = store.get('inbox', 'main') || {};
  if (ib.notes) return ib.notes;
  return ib.text?.trim() ? [{ id: 'n_first', text: ib.text.trim(), at: ib.updatedAt || new Date().toISOString() }] : [];
}
export const saveNotes = (store, notes) => store.put('inbox', 'main', { notes, updatedAt: new Date().toISOString() });

// v1 kept everything in localStorage on its own site, under ft_* keys.
export function readFitTrackerLocal() {
  const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const d = { workouts: get('ft_workouts') || [], bodyweight: get('ft_bodyweight') || [], plans: get('ft_plans') || [], notes: get('ft_notes') || [] };
  return d.workouts.length || d.bodyweight.length || d.notes.length ? d : null;
}

// v1's CSV export: Date,Workout,Exercise,Muscle,Sets,Reps,Weight,Volume
export function fitTrackerFromCSV(text) {
  const [head, ...rows] = parseCSV(text);
  if (head?.[0] !== 'Date' || head?.[2] !== 'Exercise') throw new Error('That isn’t a FitTracker workouts.csv file.');
  const by = {};
  for (const [date, name, exercise, muscle, sets, reps, weight] of rows) {
    if (!isValidKey(date) || !exercise) continue;
    (by[`${date}|${name}`] ||= { id: `csv-${date}-${slug(name)}`, date, name, exercises: [] })
      .exercises.push({ name: exercise, muscleGroup: muscle, sets: +sets || 1, reps: +reps || 0, weight: +weight || 0 });
  }
  return { workouts: Object.values(by), bodyweight: [], plans: [], notes: [] };
}

const v1Muscle = (group, name) => (MUSCLES.includes(group) ? group : guessMuscle(name) || (group === 'Legs' ? 'Quads' : null));

// Safe to run twice: workouts keep their v1 id and are skipped if already here.
export function importFitTracker(store, d) {
  const days = {}, logs = {};
  const dayOf = (k) => (days[k] ||= { ...getDay(store, k) });
  const logOf = (k) => (logs[k] ||= { ...getLog(store, k), date: k, blocks: { ...(getLog(store, k).blocks || {}) } });
  const n = { workouts: 0, sets: 0, weights: 0, notes: 0, plans: 0 };
  const perDay = {};
  for (const w of d.workouts || []) {
    if (!isValidKey(w.date)) continue;
    const id = `ft_${slug(String(w.id || `${w.date}-${w.name}`))}`;
    if (dayOf(w.date).blocks.some((b) => b.id === id)) continue;
    const i = (perDay[w.date] = (perDay[w.date] ?? -1) + 1);
    const start = Math.min(22 * 60, 17 * 60 + i * 75);
    const extra = [], items = {};
    (w.exercises || []).forEach((e, j) => {
      const name = e.name || e.exName;
      if (!name) return;
      extra.push({ id: `x${j}`, name, kind: 'reps', load: true, rx: `${Math.max(1, +e.sets || 1)}x${+e.reps || 10}`, muscle: v1Muscle(e.muscleGroup, name) });
      items[`x${j}`] = { name, sets: Array.from({ length: Math.max(1, +e.sets || 1) }, () => ({ w: +e.weight || null, r: +e.reps || null, done: true })) };
      n.sets += Math.max(1, +e.sets || 1);
    });
    const day = dayOf(w.date);
    day.blocks = sortBlocks([...day.blocks, { id, title: w.name || 'Workout', cat: 'gym', start: fromMin(start), end: fromMin(start + 60), remind: null, imported: 'fittracker' }]);
    logOf(w.date).blocks[id] = { status: 'done', title: w.name || 'Workout', cat: 'gym', plannedMin: 60, extra, items, imported: 'fittracker', updatedAt: new Date().toISOString() };
    n.workouts++;
  }
  // A day that already has a weight keeps it, so a second import changes nothing and a corrected weight stays corrected.
  for (const b of d.bodyweight || []) {
    if (!isValidKey(b.date) || !(+b.weight) || typeof (logs[b.date] || getLog(store, b.date)).wellness?.weight === 'number') continue;
    const log = logOf(b.date);
    log.wellness = { ...(log.wellness || {}), weight: +b.weight };
    n.weights++;
  }
  const rows = [
    ...Object.entries(days).filter(([k]) => d.workouts?.some((w) => w.date === k)).map(([k, v]) => ['days', k, { ...v, date: k }]),
    ...Object.entries(logs).map(([k, v]) => ['logs', k, v]),
  ];
  const have = inboxNotes(store);
  const fresh = (d.notes || []).filter((x) => x.text && !have.some((h) => h.id === `ft_${x.id}`))
    .map((x) => ({ id: `ft_${x.id}`, text: x.text, at: new Date(x.edited || x.ts || Date.now()).toISOString(), from: 'fittracker' }));
  if (fresh.length) { rows.push(['inbox', 'main', { notes: [...have, ...fresh], updatedAt: new Date().toISOString() }]); n.notes = fresh.length; }
  for (const p of d.plans || []) {
    const id = `ft-${slug(p.name)}`;
    if (!p.exercises?.length || store.get('sessions', id)) continue;
    rows.push(['sessions', id, {
      title: p.name, cat: 'gym', duration: 60, location: '', notes: 'Imported from FitTracker.',
      parts: [{ name: 'Lifts', rest: 90, items: p.exercises.map((e, j) => ({ id: `${slug(e.name)}-${j}`, name: e.name, kind: 'reps', load: true, rx: `${e.sets}x${e.reps}`, muscle: v1Muscle(e.muscleGroup, e.name) })) }],
    }]);
    n.plans++;
  }
  if (rows.length) store.putMany(rows);
  return n;
}

export const trainingMinutes = (blocks) => (blocks || []).filter((b) => isTraining(b.cat)).reduce((n, b) => n + durMin(b), 0);

// Every training block and every study block gets logged. Meals, sleep, uni and travel are covered by the daily check-in.

export const isTracked = (b) => isTraining(b.cat) || b.cat === 'study';
const credit = (st) => (st === 'done' ? 1 : st === 'partial' ? 0.5 : 0);

export function dayStats(store, k) {
  const day = getDay(store, k), log = getLog(store, k);
  const s = { planned: 0, done: 0, partial: 0, skipped: 0, open: 0, trainPlan: 0, trainDone: 0, studyPlan: 0, studyDone: 0 };
  for (const b of day.blocks) {
    if (!isTracked(b)) continue;
    const st = log.blocks?.[b.id]?.status;
    const m = durMin(b);
    s.planned++;
    s[st || 'open']++;
    if (isTraining(b.cat)) { s.trainPlan += m; s.trainDone += m * credit(st); }
    else { s.studyPlan += m; s.studyDone += m * credit(st); }
  }
  s.pct = s.planned ? (s.done + s.partial / 2) / s.planned : null;
  return s;
}

export function rangeStats(store, from, to) {
  const t = { planned: 0, done: 0, partial: 0, skipped: 0, open: 0, trainPlan: 0, trainDone: 0, studyPlan: 0, studyDone: 0 };
  for (const k of rangeKeys(from, to)) { const s = dayStats(store, k); for (const key of Object.keys(t)) t[key] += s[key]; }
  t.pct = t.planned ? (t.done + t.partial / 2) / t.planned : null;
  return t;
}

export function toLog(store, today, nowM, days = 14) {
  const out = [];
  for (const k of rangeKeys(addDays(today, -days), today).reverse()) {
    const log = getLog(store, k);
    for (const b of sortBlocks(getDay(store, k).blocks).reverse()) {
      if (!isTracked(b) || log.blocks?.[b.id]?.status) continue;
      if (k === today && toMin(b.end) > nowM) continue;
      out.push({ k, b });
    }
  }
  return out;
}

export function setStatus(store, k, b, status) {
  const entry = blockLog(store, k, b.id);
  if (!status && !entry?.items && !entry?.note) return setBlockLog(store, k, b.id, null);
  setBlockLog(store, k, b.id, { ...(entry || {}), status, sessionId: b.sessionId || null, title: b.title, cat: b.cat, plannedMin: durMin(b) });
}

export function entrySummary(store, entry) {
  let sets = 0, vol = 0;
  for (const x of entryItems(store, entry)) for (const s of doneSets(x.log)) { sets++; vol += (s.w || 0) * (s.r || 0); }
  return { sets, vol };
}

export function nextBlock(blocks, nowM) {
  const sorted = sortBlocks(blocks);
  return sorted.find((b) => toMin(b.end) > nowM) || null;
}
