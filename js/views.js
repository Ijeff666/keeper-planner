import { html, useState, useEffect, useMemo } from './lib.js';
import {
  CATS, CAT_ORDER, DOW_LABEL, DOW_LONG, addDays, avg, dow, fmtDate, fmtDur, fmtRange, isTraining, nowMin, pad, parseKey,
  programWeek, rangeKeys, sortBlocks, startOfWeek, toKey, toMin, todayKey, uid,
} from './util.js';
import { Icon, Btn, Scale, Stepper, LazyInput, Empty, toast } from './ui.js';
import { LogQueue } from './workout.js';
import * as M from './model.js';

export function TodayView({ store, actions }) {
  const today = todayKey();
  const [now, setNow] = useState(nowMin());
  useEffect(() => { const id = setInterval(() => setNow(nowMin()), 30000); return () => clearInterval(id); }, []);
  const day = M.getDay(store, today);
  const log = M.getLog(store, today);
  const program = M.getProgram(store);
  const settings = M.getSettings(store);
  const pw = programWeek(program, today);
  const blocks = sortBlocks(day.blocks);
  const next = blocks.find((b) => toMin(b.end) > now);
  const nextTraining = blocks.find((b) => isTraining(b.cat) && toMin(b.end) > now && b !== next);
  const latest = Object.entries(store.all('checkins')).sort(([a], [b]) => (a < b ? 1 : -1))[0];
  const w = log.wellness || {};
  const tracked = blocks.filter(M.isTracked);
  const logged = tracked.filter((b) => log.blocks?.[b.id]?.status).length;
  const due = M.toLog(store, today, now, 7);

  return html`<section class="today">
    <header class="today-head">
      <h1 class="today-date">${DOW_LONG[dow(today)]}<span>${parseKey(today).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span></h1>
      ${pw && !pw.before && !pw.after && html`<div class=${`scoreboard ${pw.deload ? 'deload' : ''}`}>
        <span class="sb-label">${program.name}</span>
        <span class="sb-num">Wk ${pw.wk}<small>/${program.weeks}</small></span>
        ${pw.deload && html`<span class="sb-tag">Deload</span>`}
      </div>`}
    </header>

    ${day.note
      ? html`<button class="callout big" onClick=${() => actions.openDay(today)}><b>Today’s instructions</b><span>${day.note}</span></button>`
      : html`<button class="add-note" onClick=${() => actions.openDay(today)}><${Icon} name="note" size=${16} /> Add instructions for today</button>`}

    ${next ? html`<${NextUp} store=${store} block=${next} now=${now} date=${today} actions=${actions} />`
      : blocks.length ? html`<div class="card next done-day"><h2>Done for today</h2><p>${logged} of ${tracked.length} blocks logged. Sleep well.</p></div>`
      : html`<${Empty} title="Nothing planned today" action=${html`<${Btn} kind="primary" onClick=${() => actions.go('calendar')}>Open calendar</${Btn}>`}>Fill the week from your template in the calendar.</${Empty}>`}
    ${nextTraining && html`<button class="later" onClick=${() => actions.openBlock(today, nextTraining.id)}>
      <span class=${`dot cat-${nextTraining.cat}`}></span>Later: <b>${nextTraining.title}</b> · ${fmtRange(nextTraining.start, nextTraining.end)}</button>`}

    ${due.length > 0 && html`<div class="card due-card">
      <div class="card-head"><h2>Log what you did</h2><span class="muted small">${due.length} not logged</span></div>
      <${LogQueue} store=${store} items=${due} actions=${actions} limit=${4} />
    </div>`}

    <div class="today-grid">
      <div class="card">
        <div class="card-head"><h2>Today</h2><span class="muted small">${logged}/${tracked.length} logged</span></div>
        <ol class="timeline">
          ${blocks.map((b) => {
            const st = log.blocks?.[b.id]?.status;
            return html`<li class=${`tl ${isTraining(b.cat) ? 'tl-train' : 'tl-life'} ${toMin(b.end) <= now ? 'past' : ''} ${b === next ? 'current' : ''}`}>
              <button onClick=${() => actions.openBlock(today, b.id)}>
                <span class="tl-time">${fmtRange(b.start, b.end)}</span>
                <span class=${`dot cat-${b.cat}`}></span>
                <span class="tl-title">${b.title}</span>
                ${st && html`<span class=${`status-pill st-${st}`}><${Icon} name=${st === 'done' ? 'check' : st === 'partial' ? 'half' : 'x'} size=${12} /></span>`}
              </button>
            </li>`;
          })}
        </ol>
      </div>

      <div class="card">
        <div class="card-head"><h2>Check-in</h2><span class="muted small">${w.sleep != null || w.energy ? 'Saved' : '20 seconds'}</span></div>
        <${WellnessForm} store=${store} date=${today} />
      </div>

      ${latest && html`<button class="card coach-peek" onClick=${() => actions.go('coach')}>
        <h2>${latest[1].title || 'Weekly review'}</h2>
        <p class="meta">Claude, ${fmtDate(latest[0], { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        <p class="clamp">${latest[1].summary || ''}</p>
      </button>`}
    </div>
  </section>`;
}

// The daily check-in. Today's tab shows it for today, and a past day's sheet shows it for that day, so a missed
// morning can still be filled in and the month grids don't keep a gap.
export function WellnessForm({ store, date }) {
  const settings = M.getSettings(store);
  const w = M.getLog(store, date).wellness || {};
  const setW = (patch) => M.setWellness(store, date, patch);
  const waterGoal = settings.waterGoal || 8;
  // An empty sleep stepper starts from the last night logged, so a usual night is one tap.
  const lastSleep = rangeKeys(addDays(date, -14), addDays(date, -1)).reverse().map((k) => M.getLog(store, k).wellness?.sleep).find((v) => typeof v === 'number');
  return html`<div class="wellness">
    <div class="w-row"><span>${date === todayKey() ? 'Sleep last night' : 'Sleep the night before'}</span><${Stepper} label="Sleep hours" value=${w.sleep} start=${lastSleep ?? 7.5} step=${0.5} max=${14} suffix="h" onChange=${(v) => setW({ sleep: v })} /></div>
    <div class="w-row water"><span><${Icon} name="drop" size=${16} /> Water <b>${w.water || 0}</b>/${waterGoal}</span>
      <span class="cups" role="group" aria-label="Cups of water">
        ${Array.from({ length: waterGoal }, (_, i) => html`<button type="button" class=${`cup ${i < (w.water || 0) ? 'on' : ''}`} aria-label=${`${i + 1} cups`}
          onClick=${() => setW({ water: (w.water || 0) === i + 1 ? i : i + 1 })}></button>`)}
        <button type="button" class="cup-more" onClick=${() => setW({ water: (w.water || 0) + 1 })} aria-label="One more cup">+</button>
      </span>
    </div>
    <div class="w-row"><span>Energy</span><${Scale} label="Energy" value=${w.energy} onChange=${(v) => setW({ energy: v })} labels=${['Drained', 'Low', 'OK', 'Good', 'Great']} /></div>
    <div class="w-row"><span>Soreness</span><${Scale} label="Soreness" value=${w.soreness} onChange=${(v) => setW({ soreness: v })} labels=${['None', 'Light', 'Some', 'Sore', 'Very sore']} /></div>
    <label class="w-row"><span>Pain or niggles</span><${LazyInput} value=${w.pain} placeholder="Left hip flexor tight" onCommit=${(v) => setW({ pain: v.trim() })} /></label>
    <label class="w-row"><span>Bodyweight</span><${LazyInput} type="number" inputmode="decimal" step="0.1" value=${w.weight} placeholder=${settings.units || 'lb'}
      onCommit=${(v) => setW({ weight: v === '' ? null : +v })} /></label>
  </div>`;
}

function NextUp({ store, block, now, date, actions }) {
  const s = toMin(block.start), e = toMin(block.end);
  const live = now >= s;
  const mins = live ? e - now : s - now;
  const st = M.blockLog(store, date, block.id)?.status;
  const session = M.getSession(store, block.sessionId);
  const train = isTraining(block.cat);
  return html`<div class=${`card next cat-${block.cat} ${train ? 'next-train' : ''}`}>
    <h2>${block.title}</h2>
    <p class="next-meta"><span class=${`tag ${live ? 'live' : ''}`}>${live ? `On now, ${fmtDur(mins)} left` : `In ${fmtDur(mins)}`}</span>${fmtRange(block.start, block.end)}${block.location ? ` · ${block.location}` : ''}${block.remindNote ? ` · ${block.remindNote}` : ''}</p>
    ${block.note && html`<p class="next-note">${block.note}</p>`}
    <div class="next-actions">
      ${session && html`<${Btn} kind="primary" icon="play" onClick=${() => actions.openWorkout(date, block.id)}>${st ? 'Open log' : 'Start'}</${Btn}>`}
      <${Btn} kind="quiet" onClick=${() => actions.openBlock(date, block.id)}>${session ? 'See the plan' : 'Details'}</${Btn}>
      ${train && !session && html`<${Btn} kind=${st === 'done' ? 'on' : 'quiet'} icon="check" onClick=${() => { M.setStatus(store, date, block, 'done'); toast('Logged'); }}>Done</${Btn}>`}
    </div>
  </div>`;
}

// Program weeks while a block is running; before or after one, the last four calendar weeks, so the chart keeps moving.
function weeksForRange(program, today, ws) {
  const pw = programWeek(program, today);
  if (program?.start && pw && !pw.before && !pw.after) {
    const n = Math.max(1, Math.min(program.weeks, pw.wk || 1));
    return Array.from({ length: program.weeks }, (_, i) => {
      const from = addDays(program.start, i * 7);
      return { label: `Wk ${i + 1}`, from, to: addDays(from, 6), future: i + 1 > n, deload: (program.deload || []).includes(i + 1) };
    });
  }
  const s = startOfWeek(today, ws);
  return Array.from({ length: 4 }, (_, i) => { const from = addDays(s, (i - 3) * 7); return { label: fmtDate(from, { month: 'short', day: 'numeric' }), from, to: addDays(from, 6) }; });
}

// Counts the same blocks as the "this week" percentage: every training category plus study.
function breakdown(store, from, to) {
  const s = { planned: 0, done: 0, partial: 0, skipped: 0, byCat: {} };
  for (const k of rangeKeys(from, to)) {
    const log = M.getLog(store, k);
    for (const b of M.getDay(store, k).blocks) {
      if (!M.isTracked(b)) continue;
      const st = log.blocks?.[b.id]?.status;
      const c = (s.byCat[b.cat] ||= { planned: 0, done: 0 });
      s.planned++; c.planned++;
      if (st === 'done') { s.done++; c.done++; }
      else if (st === 'partial') { s.partial++; c.done += 0.5; }
      else if (st === 'skipped') s.skipped++;
    }
  }
  return s;
}

const FLEX = new Set(['flex-light', 'flex-heavy']);
function flexDays(store, from, to) {
  return rangeKeys(from, to).map((k) => {
    const log = M.getLog(store, k);
    const bs = M.getDay(store, k).blocks.filter((b) => FLEX.has(b.sessionId));
    return { k, planned: bs.length > 0, done: bs.some((b) => ['done', 'partial'].includes(log.blocks?.[b.id]?.status)) };
  });
}
// Tonight doesn't break the streak until it's over, and nights with nothing planned are neutral.
function flexStreak(store, today) {
  const days = flexDays(store, addDays(today, -120), today);
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.k === today && !d.done) continue;
    if (d.done) n++;
    else if (d.planned) break;
  }
  return n;
}

const monthOf = (k) => k.slice(0, 7);
const daysIn = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const shiftMonth = (m, d) => { const [y, mo] = m.split('-').map(Number); const t = new Date(y, mo - 1 + d, 1); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`; };

export function ProgressView({ store, actions }) {
  const today = todayKey();
  const program = M.getProgram(store);
  const settings = M.getSettings(store);
  const units = settings.units || 'lb';
  const weekStart = settings.weekStart ?? 1;
  const weeks = weeksForRange(program, today, weekStart);
  const stats = useMemo(() => weeks.map((wk) => ({ ...wk, ...breakdown(store, wk.from, wk.to) })), [store.version, weeks[0]?.from, weeks.length]);
  const cur = stats.find((s) => today >= s.from && today <= s.to);
  const [picked, setPicked] = useState(null);
  const shown = stats.find((s) => s.from === picked) || cur || stats[stats.length - 1];
  const wsKey = startOfWeek(today, weekStart);
  // Same range as the highlighted week bar: the program week when one is running.
  const thisWeek = cur ? M.rangeStats(store, cur.from, cur.to) : M.rangeStats(store, wsKey, addDays(wsKey, 6));
  const hrs = (m) => (m / 60).toFixed(1).replace(/\.0$/, '');

  const [month, setMonth] = useState(monthOf(today));
  const n = daysIn(month);
  const last = month === monthOf(today) ? today : `${month}-${pad(n)}`;
  const days = rangeKeys(`${month}-01`, last);
  const well = Object.fromEntries(days.map((k) => [k, M.getLog(store, k).wellness || {}]));
  const flex = Object.fromEntries(flexDays(store, `${month}-01`, last).map((d) => [d.k, d]));
  const sleeps = days.map((k) => well[k].sleep).filter((v) => typeof v === 'number');
  const weights = days.filter((k) => typeof well[k].weight === 'number').map((k) => ({ k, v: well[k].weight }));
  const energy = days.filter((k) => well[k].energy).map((k) => ({ k, v: well[k].energy }));
  const sore = days.filter((k) => well[k].soreness).map((k) => ({ k, v: well[k].soreness }));
  const flexDone = Object.values(flex).filter((d) => d.done).length;
  const flexDue = Object.values(flex).filter((d) => d.done || (d.planned && d.k < today)).length;

  return html`<section class="progress">
    <header class="page-head"><h1>Progress</h1>${program && html`<span class="muted">${program.name}</span>`}</header>

    <div class="tiles">
      <div class="tile"><span class="tile-label">This week</span><span class="tile-num">${thisWeek.planned ? Math.round(thisWeek.pct * 100) : '–'}<small>%</small></span><span class="tile-sub">${thisWeek.done + thisWeek.partial} of ${thisWeek.planned} blocks logged</span></div>
      <div class="tile"><span class="tile-label">Training</span><span class="tile-num">${hrs(thisWeek.trainDone)}<small>/${hrs(thisWeek.trainPlan)}h</small></span><span class="tile-sub">this week</span></div>
      <div class="tile"><span class="tile-label">Study</span><span class="tile-num">${hrs(thisWeek.studyDone)}<small>/${hrs(thisWeek.studyPlan)}h</small></span><span class="tile-sub">this week</span></div>
      <div class="tile"><span class="tile-label">Flexibility streak</span><span class="tile-num">${flexStreak(store, today)}</span><span class="tile-sub">nights in a row</span></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Planned vs done, by week</h2><span class="legend"><i class="lg-done"></i>Done <i class="lg-partial"></i>Half <i class="lg-skip"></i>Skipped <i class="lg-open"></i>Not logged</span></div>
      <div class="wk-bars">
        ${stats.map((s) => {
          const max = Math.max(1, ...stats.map((x) => x.planned));
          const seg = (v) => `${(v / max) * 100}%`;
          return html`<button type="button" class=${`wk-bar ${s.future ? 'future' : ''} ${s === shown ? 'on' : ''}`} onClick=${() => setPicked(s.from)} aria-pressed=${s === shown}>
            <span class="wk-bar-label">${s.label}${s.deload ? html`<small>deload</small>` : ''}</span>
            <span class="wk-bar-track">
              <span class="seg done" style=${`width:${seg(s.done)}`}></span>
              <span class="seg partial" style=${`width:${seg(s.partial)}`}></span>
              <span class="seg skip" style=${`width:${seg(s.skipped)}`}></span>
              <span class="seg open" style=${`width:${seg(s.planned - s.done - s.partial - s.skipped)}`}></span>
            </span>
            <span class="wk-bar-num">${s.planned ? Math.round(((s.done + s.partial / 2) / s.planned) * 100) : 0}%</span>
          </button>`;
        })}
      </div>
      ${shown && html`<div class="cat-split">
        <span class="cat-split-wk">${shown.label}</span>
        ${CAT_ORDER.filter((c) => shown.byCat[c]).map((c) => html`<span class=${`cat-stat cat-${c}`}><i class="dot"></i>${CATS[c].short} ${shown.byCat[c].done}/${shown.byCat[c].planned}</span>`)}
        ${!Object.keys(shown.byCat).length && html`<span class="muted">Nothing planned</span>`}
      </div>`}
    </div>

    <div class="month-head">
      <button type="button" class="icon-btn" onClick=${() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><${Icon} name="left" /></button>
      <h2>${parseKey(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
      <button type="button" class="icon-btn" onClick=${() => setMonth(shiftMonth(month, 1))} disabled=${month >= monthOf(today)} aria-label="Next month"><${Icon} name="right" /></button>
      ${month === monthOf(today) && html`<span class="meta">month to date</span>`}
    </div>

    <div class="progress-grid">
      <div class="card">
        <div class="card-head"><h2>Sleep</h2>${sleeps.length > 0 && html`<span class="muted small">avg ${avg(sleeps).toFixed(1)}h · ${sleeps.filter((v) => v < 7).length} nights under 7h</span>`}</div>
        <${DayGrid} month=${month} n=${n} today=${today} weekStart=${weekStart} onPick=${actions.openDay} cell=${(k) => {
          const v = well[k]?.sleep;
          if (typeof v !== 'number') return { cls: '', label: 'no entry' };
          return { cls: v < 6 ? 'sl-bad' : v < 7 ? 'sl-low' : v <= 9.5 ? 'sl-ok' : 'sl-long', v, label: `${v} hours` };
        }} />
        <p class="legend dg-legend"><i class="sl-bad"></i>under 6h <i class="sl-low"></i>6 to 7 <i class="sl-ok"></i>7 to 9.5 <i class="sl-long"></i>over 9.5</p>
      </div>

      <div class="card">
        <div class="card-head"><h2>Flexibility</h2><span class="muted small">${flexDone} of ${flexDue} nights</span></div>
        <${DayGrid} month=${month} n=${n} today=${today} weekStart=${weekStart} onPick=${actions.openDay} cell=${(k) => {
          const d = flex[k];
          if (d?.done) return { cls: 'fx-done', icon: 'check', label: 'done' };
          if (d?.planned && k < today) return { cls: 'fx-miss', label: 'missed' };
          return { cls: '', label: d?.planned ? 'planned' : 'nothing planned' };
        }} />
      </div>

      <div class="card">
        <div class="card-head"><h2>Bodyweight</h2>${weights.length > 1 && html`<span class="muted small">${weights.at(-1).v - weights[0].v >= 0 ? '+' : ''}${(weights.at(-1).v - weights[0].v).toFixed(1)} ${units} this month</span>`}</div>
        ${weights.length ? html`<${MonthLines} month=${month} n=${n} unit=${units} onPick=${actions.openDay} series=${[{ cls: 'weight', pts: weights }]} />`
          : html`<p class="muted">Log your weight in a daily check-in (Today, or tap a day) and the month’s trend shows here.</p>`}
      </div>

      <div class="card">
        <div class="card-head"><h2>Recovery</h2><span class="legend"><i class="lg-energy"></i>Energy <i class="lg-sore"></i>Soreness</span></div>
        ${energy.length || sore.length ? html`<${MonthLines} month=${month} n=${n} lo=${1} hi=${5} ticks=${[1, 3, 5]} onPick=${actions.openDay}
            series=${[{ cls: 'energy', pts: energy }, { cls: 'sore', pts: sore }]} />`
          : html`<p class="muted">Rate energy and soreness in a daily check-in and they chart here.</p>`}
      </div>
    </div>
  </section>`;
}

// One cell per day, laid out like a calendar month so a missed night is easy to spot.
function DayGrid({ month, n, today, weekStart, cell, onPick }) {
  const lead = (dow(`${month}-01`) - weekStart + 7) % 7;
  return html`<div class="daygrid">
    ${Array.from({ length: 7 }, (_, i) => html`<span class="dg-h">${DOW_LABEL[(weekStart + i) % 7].slice(0, 2)}</span>`)}
    ${Array.from({ length: lead }, () => html`<span></span>`)}
    ${Array.from({ length: n }, (_, i) => {
      const k = `${month}-${pad(i + 1)}`;
      const c = k > today ? { cls: 'future', label: 'not yet' } : cell(k);
      return html`<button type="button" class=${`dg-cell ${c.cls} ${k === today ? 'is-today' : ''}`} disabled=${k > today}
          onClick=${() => onPick(k)} aria-label=${`${fmtDate(k, { month: 'long', day: 'numeric' })}: ${c.label}`}>
        <span class="dg-d">${i + 1}</span>
        ${c.v != null && html`<span class="dg-v">${c.v}</span>`}
        ${c.icon && html`<span class="dg-v"><${Icon} name=${c.icon} size=${14} /></span>`}
      </button>`;
    })}
  </div>`;
}

// x is the day of the month, so the empty right side shows how much of the month is left.
function MonthLines({ month, n, series, lo, hi, ticks, unit = '', onPick }) {
  const W = 420, H = 180, pl = 36, pr = 10, pt = 12, pb = 24;
  const vals = series.flatMap((s) => s.pts.map((p) => p.v));
  if (lo == null) {
    const a = Math.min(...vals), b = Math.max(...vals);
    lo = Math.floor(a - Math.max(1, (b - a) * 0.2));
    hi = Math.ceil(b + Math.max(1, (b - a) * 0.2));
    ticks = [lo, Math.round((lo + hi) / 2), hi];
  }
  const x = (k) => pl + ((+k.slice(8) - 1) / Math.max(1, n - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - lo) / (hi - lo || 1)) * (H - pt - pb);
  return html`<div class="chart-wrap"><svg viewBox=${`0 0 ${W} ${H}`} class="chart" role="img" aria-label=${`${series.map((s) => s.cls).join(' and ')} this month`}>
    ${ticks.map((t) => html`<g><line x1=${pl} x2=${W - pr} y1=${y(t)} y2=${y(t)} class="grid" /><text x=${pl - 6} y=${y(t) + 4} class="axis" text-anchor="end">${t}</text></g>`)}
    ${series.map((s) => html`<g>
      <path d=${s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`).join('')} class=${`line ${s.cls}`} />
      ${s.pts.map((p) => html`<g class="pt-btn" onClick=${() => onPick(p.k)}>
        <circle cx=${x(p.k)} cy=${y(p.v)} r="14" class="pt-hit" />
        <circle cx=${x(p.k)} cy=${y(p.v)} r="4" class=${`pt ${s.cls}`} />
        <title>${fmtDate(p.k)}: ${p.v}${unit ? ` ${unit}` : ''}</title></g>`)}
    </g>`)}
    ${[1, 8, 15, 22, 29].filter((d) => d <= n).map((d) => html`<text x=${pl + ((d - 1) / Math.max(1, n - 1)) * (W - pl - pr)} y=${H - 6} class="axis" text-anchor="middle">${d}</text>`)}
  </svg></div>`;
}

export function CoachView({ store }) {
  const checkins = Object.entries(store.all('checkins')).sort(([a], [b]) => (a < b ? 1 : -1));
  const notes = M.inboxNotes(store);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const addNote = () => {
    if (!text.trim()) return;
    M.saveNotes(store, [{ id: uid('n'), text: text.trim(), at: new Date().toISOString() }, ...notes]);
    setText('');
    toast('Saved. Claude reads it at your next check-in.');
  };
  const saveEdit = () => {
    if (!editing?.text.trim()) return;
    M.saveNotes(store, notes.map((n) => (n.id === editing.id ? { ...n, text: editing.text.trim(), edited: new Date().toISOString() } : n)));
    setEditing(null);
  };
  const removeNote = (id) => {
    const before = notes;
    M.saveNotes(store, notes.filter((n) => n.id !== id));
    toast('Note deleted', { action: 'Undo', onAction: () => M.saveNotes(store, before) });
  };

  const ask = async () => {
    const prompt = `About my Keeper Planner training app (Supabase project "keeper-planner"): ${q.trim()}\n\nRead my recent days, logs and check-ins before you answer.`;
    try { await navigator.clipboard.writeText(prompt); } catch { /* clipboard blocked */ }
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, '_blank', 'noopener');
    setQ('');
  };

  return html`<section class="coach">
    <header class="page-head"><h1>Coach</h1></header>
    <p class="lede">Claude reads your logs every Sunday at 8pm and posts a review here. Anytime, open Claude and say <q>check my training</q>.</p>

    <div class="coach-grid">
      <div class="card">
        <div class="card-head"><h2>Ask Claude</h2></div>
        <form class="ask" onSubmit=${(e) => { e.preventDefault(); if (q.trim()) ask(); }}>
          <input value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Can I swap Thursday legs for Friday this week?" aria-label="Question for Claude" />
          <${Btn} kind="primary" icon="send" type="submit" disabled=${!q.trim()}>Ask</${Btn}>
        </form>
        <p class="muted small">Opens Claude with your question. Claude can read and change this app’s data from there.</p>
      </div>
      <div class="card">
        <div class="card-head"><h2>Notes and goals</h2><span class="muted small">Claude reads these at every check-in</span></div>
        <form onSubmit=${(e) => { e.preventDefault(); addNote(); }}>
          <textarea rows="3" value=${text} onInput=${(e) => setText(e.target.value)}
            placeholder="Goals, exams coming up, a sore hip, a game moved to Saturday…"></textarea>
          <div class="row-end"><${Btn} kind="primary" type="submit" disabled=${!text.trim()}>Save note</${Btn}></div>
        </form>
        ${notes.length > 0 && html`<ul class="notes">
          ${notes.map((n) => html`<li class="note" key=${n.id}>
            ${editing?.id === n.id
              ? html`<textarea rows="3" value=${editing.text} onInput=${(e) => setEditing({ ...editing, text: e.target.value })} data-autofocus></textarea>
                <div class="row-end"><${Btn} kind="quiet" onClick=${() => setEditing(null)}>Cancel</${Btn}><${Btn} kind="primary" onClick=${saveEdit}>Save</${Btn}></div>`
              : html`<p>${n.text}</p>
                <div class="note-foot">
                  <span class="muted small">${fmtDate(toKey(new Date(n.at)), { month: 'short', day: 'numeric' })}${n.edited ? ' · edited' : ''}${n.from === 'fittracker' ? ' · from FitTracker' : ''}</span>
                  <span class="grow"></span>
                  <button type="button" class="icon-btn sm" onClick=${() => setEditing({ id: n.id, text: n.text })} aria-label="Edit note"><${Icon} name="edit" size=${16} /></button>
                  <button type="button" class="icon-btn sm" onClick=${() => removeNote(n.id)} aria-label="Delete note"><${Icon} name="trash" size=${16} /></button>
                </div>`}
          </li>`)}
        </ul>`}
      </div>
    </div>

    <h2 class="section-title">Check-ins</h2>
    ${checkins.length ? checkins.map(([id, c]) => html`<${CheckinCard} key=${id} id=${id} c=${c} store=${store} />`)
      : html`<${Empty} title="No check-ins yet">The first weekly review posts here on Sunday night.</${Empty}>`}
  </section>`;
}

function CheckinCard({ id, c, store }) {
  const [reply, setReply] = useState(c.reply || '');
  const list = (title, xs, cls) => xs?.length ? html`<div class=${`ci-list ${cls}`}><h4>${title}</h4><ul>${xs.map((x) => html`<li>${x}</li>`)}</ul></div>` : null;
  const send = () => { store.put('checkins', id, { ...c, reply, replyAt: new Date().toISOString() }); toast('Reply saved. Claude reads it at the next check-in.'); };
  return html`<article class="card checkin">
    <h3>${c.title || 'Check-in'}</h3>
    <p class="meta">${fmtDate(c.date || id, { weekday: 'short', month: 'short', day: 'numeric' })}${c.week ? ` · ${c.week}` : ''}</p>
    ${c.summary && c.summary.split(/\n\n+/).map((p) => html`<p>${p}</p>`)}
    <div class="ci-cols">
      ${list('Wins', c.wins, 'good')}
      ${list('Watch', c.flags, 'warn')}
      ${list('Changes I made', c.changes, '')}
      ${list('Questions for you', c.questions, '')}
    </div>
    <div class="ci-reply">
      <textarea rows="2" value=${reply} onInput=${(e) => setReply(e.target.value)} placeholder="Reply to Claude"></textarea>
      <${Btn} kind=${c.reply === reply && reply ? 'quiet' : 'primary'} onClick=${send} disabled=${!reply.trim() || reply === c.reply}>${c.reply && c.reply === reply ? 'Sent' : 'Send reply'}</${Btn}>
    </div>
  </article>`;
}
