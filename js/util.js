// Dates are local 'YYYY-MM-DD' keys and times are local 'HH:MM' strings ('24:00' = midnight end).
// Nothing here touches UTC, so daylight-saving changes never shift a block.

export const CATS = {
  team:     { label: 'Team practice',       short: 'Team',     training: true },
  gk:       { label: 'GK training',         short: 'GK',       training: true },
  gym:      { label: 'Gym / strength',      short: 'Gym',      training: true },
  plyo:     { label: 'Plyo / speed',        short: 'Plyo',     training: true },
  recovery: { label: 'Mobility & recovery', short: 'Recovery', training: true },
  game:     { label: 'Games / pickup',      short: 'Game',     training: true },
  film:     { label: 'Film & recruiting',   short: 'Film',     training: true },
  uni:      { label: 'Uni',                 short: 'Uni',      training: false },
  study:    { label: 'Study',               short: 'Study',    training: false },
  meal:     { label: 'Meals',               short: 'Meal',     training: false },
  sleep:    { label: 'Sleep',               short: 'Sleep',    training: false },
  life:     { label: 'Personal / travel',   short: 'Life',     training: false },
};
export const CAT_ORDER = Object.keys(CATS);
export const isTraining = (cat) => !!CATS[cat]?.training;

export const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayKey = () => toKey(new Date());
export const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return toKey(d); };
export const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
export const dow = (k) => parseKey(k).getDay();
export const startOfWeek = (k, weekStart = 1) => addDays(k, -((dow(k) - weekStart + 7) % 7));
export const isValidKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k || '');
export const fmtDate = (k, opts) =>
  parseKey(k).toLocaleDateString(undefined, opts || { weekday: 'short', month: 'short', day: 'numeric' });
export const rangeKeys = (from, to) => {
  const out = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
};

export const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export function fmtTime(t, { short } = {}) {
  const m = typeof t === 'number' ? t : toMin(t);
  let h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  const base = mm ? `${h}:${pad(mm)}` : `${h}`;
  return short ? base : base + ap;
}
export function fmtRange(a, b) {
  const ma = toMin(a), mb = toMin(b);
  const sameHalf = (ma < 720) === (mb < 720) && mb < 1440;
  return `${fmtTime(ma, { short: sameHalf })}–${fmtTime(mb)}`;
}
export const durMin = (b) => Math.max(0, toMin(b.end) - toMin(b.start));
export const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
export const uid = (p = 'b') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const snap = (m, step = 15) => Math.round(m / step) * step;
export const sortBlocks = (bs) => [...(bs || [])].sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end));
export const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';

export function programWeek(program, dateKey) {
  if (!program?.start) return null;
  const d = daysBetween(program.start, dateKey);
  if (d < 0) return { wk: 0, before: true, label: 'Before block' };
  const wk = Math.floor(d / 7) + 1;
  if (wk > (program.weeks || 4)) return { wk, after: true, label: 'Block finished' };
  const deload = (program.deload || []).includes(wk);
  return { wk, deload, label: `Wk ${wk} of ${program.weeks}${deload ? ' · Deload' : ''}` };
}

// The prescription an item has for a given program week. Weeks outside the block use the nearest week.
export function rxFor(item, wk) {
  const arr = item?.byWeek;
  if (!arr || !arr.length) return item?.rx || '';
  const i = clamp((wk || 1), 1, arr.length) - 1;
  return arr[i] || '';
}
export const partNoteFor = (part, wk) => (part?.noteByWeek?.length ? rxFor({ byWeek: part.noteByWeek }, wk) : '');

// Turn '4x6-8', '3x45 sec/side', '12/side', '3 rounds' into something loggable.
export function parseRx(rx) {
  if (!rx) return { text: '' };
  const s = rx.toLowerCase().trim();
  if (s === '—' || s === '-' || s === 'skip') return { skip: true };
  const perSide = /\/(side|leg|arm|foot)|each (side|foot|leg|arm)/.test(s);
  let m = s.match(/(\d+)\s*[x×]\s*\(/);
  if (m) return { sets: +m[1], reps: null, perSide, text: rx };
  m = s.match(/(\d+)\s*[x×]\s*(\d+)(?:\s*-\s*(\d+))?\s*(sec|s\b|min)?/);
  if (m) {
    const sets = +m[1], a = +m[2], b = m[3] ? +m[3] : null;
    if (m[4]) return { sets, secs: m[4] === 'min' ? a * 60 : a, perSide };
    return { sets, reps: a, repsMax: b, perSide };
  }
  m = s.match(/(\d+)\s*(sec|min)/);
  if (m) return { sets: 1, secs: m[2] === 'min' ? +m[1] * 60 : +m[1], perSide };
  m = s.match(/(\d+)\s*rounds?/);
  if (m) return { sets: +m[1], reps: null, perSide, rounds: true };
  m = s.match(/^x?(\d+)/);
  if (m) return { sets: 1, reps: +m[1], perSide };
  return { text: rx };
}

// Epley estimate. Above 12 reps it overshoots, so those sets don't count toward a 1RM.
export const e1rm = (w, r) => (!w || !r || r > 12 ? 0 : r === 1 ? w : Math.round(w * (1 + r / 30)));

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Core'];

// Hard sets per week. 10-20 is the usual range for building a muscle.
export function muscleZone(sets) {
  if (sets >= 21) return { key: 'high', label: 'High' };
  if (sets >= 10) return { key: 'build', label: 'Build' };
  if (sets >= 4) return { key: 'keep', label: 'Maintain' };
  return { key: 'low', label: sets ? 'Low' : 'None' };
}

// For exercises without a muscle tag (added on the fly, swapped in, or imported from FitTracker).
const MUSCLE_WORDS = [
  ['Hamstrings', /rdl|romanian|leg curl|hamstring|good morning|nordic|stiff/], ['Glutes', /glute|hip thrust|bridge|kickback/],
  ['Calves', /calf|calves/], ['Adductors', /copenhagen|adduct/], ['Quads', /squat|leg press|lunge|split|step.?up|leg ext|hack|quad|legs?\b/],
  ['Chest', /bench|chest|push.?up|fly|dip|pec|incline|decline/], ['Triceps', /tricep|pushdown|skull|close.?grip|extension/],
  ['Forearms', /wrist|grip|forearm|squeeze|farmer/], ['Biceps', /curl|bicep/],
  ['Shoulders', /shoulder|overhead|ohp|lateral|raise|face pull|arnold|military|delt/],
  ['Back', /row|pull|lat|deadlift|chin|back|shrug/], ['Core', /plank|core|ab|crunch|dead ?bug|pallof|sit.?up|rotation/],
];
export function guessMuscle(name) {
  const s = (name || '').toLowerCase();
  return MUSCLE_WORDS.find(([, re]) => re.test(s))?.[0] || null;
}

export function layoutDay(blocks) {
  const items = (blocks || []).map((b) => {
    const s = toMin(b.start);
    return { b, s, e: Math.max(toMin(b.end), s + 15), col: 0, ncol: 1 };
  }).sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex((end) => end <= it.s);
      if (c < 0) { c = cols.length; cols.push(it.e); } else cols[c] = it.e;
      it.col = c;
    }
    for (const it of cluster) it.ncol = cols.length;
    out.push(...cluster);
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

const DAY_RE = /\b(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/g;
const T = '(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a|p)?';
const RANGE_RE = new RegExp(`(?:^|\\s)${T}\\s*(?:-|–|to)\\s*${T}(?=\\s|$)`);
const SINGLE_RE = /(?:^|\s)(?:@|at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)(?=\s|$)|(?:^|\s)(?:@|at\s+)?(\d{1,2}):(\d{2})(?=\s|$)/;

const words = (s) => (s || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);

function hour24(h, mer) {
  if (mer) {
    const pm = mer[0] === 'p';
    if (pm && h < 12) return h + 12;
    if (!pm && h === 12) return 0;
    return h;
  }
  if (h >= 1 && h <= 6) return h + 12; // a bare 3 almost always means 3pm in this schedule
  return h;
}

function score(queryWords, keys) {
  let n = 0;
  for (const k of keys) {
    if (queryWords.some((q) => q.length >= 3 && (k.startsWith(q) || q.startsWith(k.slice(0, Math.max(3, k.length - 1)))))) n++;
  }
  return n;
}

// 'thu 4pm legs plyo', 'study 3-5', 'mon wed 7:30-9pm practice'
export function parseQuick(text, { today, fallbackDate, sessions = [], lifePresets = [], defaultRemind = 30 }) {
  let s = ' ' + (text || '').toLowerCase().replace(/,/g, ' ') + ' ';
  const dates = [];
  s = s.replace(/\b(today|tonight)\b/g, () => { dates.push(today); return ' '; });
  s = s.replace(/\b(tomorrow|tmrw|tmr)\b/g, () => { dates.push(addDays(today, 1)); return ' '; });
  s = s.replace(DAY_RE, (m) => {
    const idx = DOW.indexOf(m.slice(0, 3));
    const delta = (idx - dow(today) + 7) % 7;
    dates.push(addDays(today, delta));
    return ' ';
  });

  let start = null, end = null;
  const r = s.match(RANGE_RE);
  if (r) {
    let [, h1, m1, a1, h2, m2, a2] = r;
    h1 = +h1; h2 = +h2; m1 = +(m1 || 0); m2 = +(m2 || 0);
    if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return { error: 'That time doesn’t look right.' };
    if (a2 && !a1) {
      const s12 = (h1 % 12) * 60 + m1, e12 = (h2 % 12) * 60 + m2;
      a1 = s12 <= e12 ? a2 : (a2[0] === 'p' ? 'am' : 'pm');
    }
    let sh = hour24(h1, a1);
    let eh = a2 ? hour24(h2, a2) : (a1 ? hour24(h2, a1) : h2);
    start = sh * 60 + m1;
    end = eh * 60 + m2;
    while (end <= start && end + 720 <= 1440) end += 720;
    if (end <= start) end = start + 60;
    s = s.replace(r[0], ' ');
  } else {
    const t = s.match(SINGLE_RE);
    if (t) {
      if (t[1]) start = hour24(+t[1], t[3]) * 60 + +(t[2] || 0);
      else start = hour24(+t[4], null) * 60 + +t[5];
      s = s.replace(t[0], ' ');
    }
  }

  const q = words(s).filter((w) => !['at', 'from', 'to', 'the', 'for', 'and', 'my', 'pm', 'am'].includes(w));
  let best = null, bestScore = 0;
  for (const ses of sessions) {
    const sc = score(q, [...words(ses.title), ...(ses.keywords || [])]);
    if (sc > bestScore) { best = { kind: 'session', ses }; bestScore = sc; }
  }
  for (const p of lifePresets) {
    const sc = score(q, [...words(p.title), ...(p.keywords || [])]);
    if (sc > bestScore) { best = { kind: 'life', p }; bestScore = sc; }
  }

  const leftover = q.join(' ');
  let block = { title: leftover ? leftover[0].toUpperCase() + leftover.slice(1) : 'New block', cat: 'life', remind: null };
  let dur = 60;
  if (best?.kind === 'session') {
    const ses = best.ses;
    block = { title: ses.title, cat: ses.cat, sessionId: ses.id, location: ses.location || '', remind: ses.remind ?? (isTraining(ses.cat) ? defaultRemind : null), remindNote: ses.remindNote || '' };
    dur = ses.duration || 60;
  } else if (best?.kind === 'life') {
    block = { title: best.p.title, cat: best.p.cat, remind: null };
    dur = best.p.dur || 60;
  }
  if (start == null) return { error: 'Add a time, like “4pm” or “3-5”.', block, dates };
  if (end == null) end = Math.min(start + dur, 1440);
  return {
    dates: dates.length ? [...new Set(dates)].sort() : [fallbackDate || today],
    block: { ...block, start: fromMin(start), end: fromMin(Math.min(end, 1440)) },
    matched: !!best,
  };
}

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export const avg = (xs) => { const v = xs.filter((x) => typeof x === 'number' && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

export const downloadJSON = (name, data) => downloadFile(name, JSON.stringify(data, null, 2), 'application/json');
export const toCSV = (rows) => rows.map((r) => r.map((v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\n');
// Small CSV reader for FitTracker v1 exports (quoted fields, no embedded newlines).
export function parseCSV(text) {
  return text.trim().split(/\r?\n/).map((line) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out;
  });
}

export function downloadFile(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
