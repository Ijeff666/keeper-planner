import { html, useState, useMemo } from './lib.js';
import {
  MUSCLES, addDays, daysBetween, downloadFile, fmtDate, fmtDur, fmtRange, guessMuscle, muscleZone, nowMin, parseRx, rxFor, slug,
  startOfWeek, todayKey, uid,
} from './util.js';
import { Icon, Btn, Sheet, Field, Empty, toast } from './ui.js';
import { weekFor } from './workout.js';
import * as M from './model.js';

const fmtSet = (s) => (s.s != null && s.r == null ? `${s.s}s` : s.w ? `${s.w}×${s.r ?? '–'}` : `${s.r ?? '–'}`);

export function GymView({ store, actions, active }) {
  const today = todayKey();
  const settings = M.getSettings(store);
  const units = settings.units || 'lb';
  const { wk } = weekFor(M.getProgram(store), today);
  const [editing, setEditing] = useState(null);
  const plans = M.sessionsList(store).filter(M.isGymSession);
  const todayLog = M.getLog(store, today);
  const planned = M.getDay(store, today).blocks
    .filter((b) => plans.some((p) => p.id === b.sessionId) && !todayLog.blocks?.[b.id]?.status);
  const ws = startOfWeek(today, settings.weekStart ?? 1);
  const history = useMemo(() => M.liftHistory(store), [store.version]);
  const recent = useMemo(() => M.workoutHistory(store, 40), [store.version]);
  const muscles = useMemo(() => M.muscleSets(store, ws, addDays(ws, 6)), [store.version, ws]);
  const weekVol = recent.filter((r) => r.k >= ws).reduce((n, r) => n + r.vol, 0);
  const activeBlock = active && M.getDay(store, active.date).blocks.find((b) => b.id === active.id);
  const start = (sessionId) => actions.openWorkout(today, M.startWorkout(store, today, nowMin(), sessionId));

  return html`<section class="gym">
    <header class="page-head">
      <h1>Gym</h1>
      <p class="gym-stats"><span><b>${M.weekStreak(store, today, settings.weekStart ?? 1)}</b> week streak</span><span><b>${Math.round(weekVol).toLocaleString()}</b> ${units} this week</span></p>
    </header>

    ${activeBlock && html`<button type="button" class="card resume" onClick=${actions.resumeWorkout}>
      <span class="resume-dot" aria-hidden="true"></span>
      <span class="grow"><b>${activeBlock.title}</b> is in progress</span>
      <span class="btn btn-primary">Resume</span>
    </button>`}

    ${!activeBlock && planned.length > 0 && html`<div class="card gym-today">
      ${planned.map((b) => html`<div class="gym-today-row">
        <span class=${`dot cat-${b.cat}`}></span>
        <span class="grow"><b>${b.title}</b><span class="meta"> · today ${fmtRange(b.start, b.end)}</span></span>
        <${Btn} kind="primary" icon="play" onClick=${() => actions.openWorkout(today, b.id)}>Start</${Btn}>
      </div>`)}
    </div>`}

    <div class="row-gap">
      <${Btn} kind=${planned.length || activeBlock ? 'quiet' : 'primary'} icon="play" onClick=${() => start(null)}>Empty workout</${Btn}>
      <${Btn} kind="quiet" icon="plus" onClick=${() => setEditing(blankPlan())}>New workout</${Btn}>
    </div>

    <section>
      <h2 class="section-title">Workouts</h2>
      ${plans.length ? html`<div class="plans">
        ${plans.map((p) => html`<${PlanCard} key=${p.id} store=${store} plan=${p} wk=${wk} units=${units} onStart=${() => start(p.id)} onEdit=${() => setEditing(structuredClone(p))} />`)}
      </div>` : html`<${Empty} title="No workouts yet" action=${html`<${Btn} kind="primary" icon="plus" onClick=${() => setEditing(blankPlan())}>New workout</${Btn}>`}>Build one and it shows up here, ready to start.</${Empty}>`}
    </section>

    <section>
      <h2 class="section-title">History</h2>
      <${History} items=${recent.slice(0, 12)} units=${units} actions=${actions} />
    </section>

    <div class="progress-grid">
      <${Lifts} history=${history} units=${units} onPick=${actions.openDay} />
      <${PRBoard} history=${history} units=${units} onPick=${actions.openDay} />
      <div class="card">
        <div class="card-head"><h2>Muscles this week</h2><span class="muted small">sets · 10 to 20 builds muscle</span></div>
        <${MuscleBars} muscles=${muscles} today=${today} onPick=${actions.openDay} />
      </div>
    </div>
    <div class="row-end"><${Btn} kind="quiet" icon="download" onClick=${() => downloadFile(`keeper-sets-${today}.csv`, M.setsCSV(store), 'text/csv')}>Export sets (CSV)</${Btn}></div>

    ${editing && html`<${PlanEditor} store=${store} plan=${editing} wk=${wk} onClose=${() => setEditing(null)} />`}
  </section>`;
}

function PlanCard({ store, plan, wk, units, onStart, onEdit }) {
  const items = (plan.parts || []).flatMap((p) => p.items).filter((it) => it.kind !== 'check' && !parseRx(rxFor(it, wk)).skip);
  const muscles = [...new Set(items.map((it) => it.muscle || guessMuscle(it.name)).filter(Boolean))].slice(0, 4);
  const last = M.lastDone(store, plan.id);
  return html`<article class=${`plan-card cat-${plan.cat}`}>
    <div class="plan-top">
      <h3>${plan.title}</h3>
      <button type="button" class="icon-btn sm" onClick=${onEdit} aria-label=${`Edit ${plan.title}`}><${Icon} name="edit" size=${16} /></button>
    </div>
    <p class="meta">${items.length} exercises · ${fmtDur(plan.duration || 60)}${last ? ` · last done ${fmtDate(last, { month: 'short', day: 'numeric' })}` : ''}</p>
    <ul class="plan-peek">
      ${items.slice(0, 5).map((it) => html`<li><span>${it.name}</span><span class="rx">${rxFor(it, wk)}${it.weight ? ` @ ${it.weight}` : ''}</span></li>`)}
      ${items.length > 5 && html`<li class="muted">and ${items.length - 5} more</li>`}
    </ul>
    <div class="plan-foot">
      <span class="plan-muscles">${muscles.join(' · ')}</span>
      <${Btn} kind="primary" icon="play" onClick=${onStart}>Start</${Btn}>
    </div>
  </article>`;
}

function History({ items, units, actions }) {
  const [open, setOpen] = useState(null);
  if (!items.length) return html`<p class="muted">Finished workouts land here with every set.</p>`;
  return html`<ul class="history">
    ${items.map((w) => {
      const key = `${w.k}:${w.blockId}`;
      const isOpen = open === key;
      return html`<li class="hist" key=${key}>
        <button type="button" class="hist-head" onClick=${() => setOpen(isOpen ? null : key)} aria-expanded=${isOpen}>
          <span class="hist-title">${w.entry.title || 'Workout'}</span>
          <span class="meta">${fmtDate(w.k, { weekday: 'short', month: 'short', day: 'numeric' })} · ${w.sets} sets${w.vol ? ` · ${Math.round(w.vol).toLocaleString()} ${units}` : ''}</span>
          <${Icon} name=${isOpen ? "up" : "down"} size=${16} />
        </button>
        ${isOpen && html`<div class="hist-body">
          ${w.items.map((x) => html`<div class="hist-row"><span>${x.name}</span><span class="mono">${x.log.sets.filter((s) => s.done).map(fmtSet).join('  ')}</span></div>`)}
          ${w.entry.note && html`<p class="meta">${w.entry.note}</p>`}
          <div class="row-gap"><${Btn} kind="quiet" icon="edit" onClick=${() => actions.openWorkout(w.k, w.blockId)}>Edit log</${Btn}><${Btn} kind="quiet" onClick=${() => actions.openDay(w.k)}>See the day</${Btn}></div>
        </div>`}
      </li>`;
    })}
  </ul>`;
}

function Lifts({ history, units, onPick }) {
  const lifts = Object.values(history).sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
  const [key, setKey] = useState(null);
  const lift = lifts.find((l) => l.key === key) || lifts[0];
  return html`<div class="card">
    <div class="card-head"><h2>Lifts</h2>
      ${lifts.length > 0 && html`<select value=${lift?.key} onChange=${(e) => setKey(e.target.value)} aria-label="Lift">${lifts.map((l) => html`<option value=${l.key}>${l.name}</option>`)}</select>`}
    </div>
    ${lift ? html`<p class="lift-sum">Heaviest ${lift.heaviest.w} ${units}${lift.pr?.e1rm ? ` · est. 1RM ${lift.pr.e1rm}` : ''} · last ${lift.points.at(-1).w} × ${lift.points.at(-1).r ?? '–'}</p>
        <${LineChart} points=${lift.points} units=${units} onPick=${onPick} />`
      : html`<p class="muted">Log weights and your top set for each lift charts here.</p>`}
  </div>`;
}

function PRBoard({ history, units, onPick }) {
  const prs = Object.values(history).filter((l) => l.pr?.e1rm).sort((a, b) => (a.pr.k < b.pr.k ? 1 : -1));
  return html`<div class="card">
    <div class="card-head"><h2><${Icon} name="trophy" size=${18} /> Records</h2><span class="muted small">best estimated 1RM</span></div>
    ${prs.length ? html`<ul class="pr-list">
      ${prs.slice(0, 10).map((l) => html`<li><button type="button" onClick=${() => onPick(l.pr.k)}>
        <span class="pr-name">${l.name}</span>
        <span class="pr-set">${l.pr.w} × ${l.pr.r}</span>
        <span class="pr-est">${l.pr.e1rm} ${units}</span>
        <span class="pr-date">${fmtDate(l.pr.k, { month: 'short', day: 'numeric' })}</span>
      </button></li>`)}
    </ul>` : html`<p class="muted">Your best set on each lift shows here. New records also pop up mid-workout.</p>`}
  </div>`;
}

function MuscleBars({ muscles, today, onPick }) {
  const rows = MUSCLES.map((m) => ({ m, sets: muscles.sets[m] || 0, last: muscles.last[m] })).filter((r) => r.sets || r.last);
  if (!rows.length) return html`<p class="muted">Log sets and each muscle’s weekly volume shows here.</p>`;
  const max = Math.max(20, ...rows.map((r) => r.sets));
  return html`<ul class="muscles">
    ${rows.map((r) => {
      const ago = r.last ? daysBetween(r.last, today) : null;
      return html`<li class=${`muscle z-${muscleZone(r.sets).key}`}>
        <span class="m-name">${r.m}</span>
        <span class="m-track"><i style=${`width:${(r.sets / max) * 100}%`}></i><b class="m-lo" style=${`left:${(10 / max) * 100}%`}></b><b class="m-hi" style=${`left:${(20 / max) * 100}%`}></b></span>
        <span class="m-sets">${r.sets}</span>
        <button type="button" class=${`m-ago ${ago >= 7 ? 'old' : ''}`} onClick=${() => r.last && onPick(r.last)} disabled=${!r.last}>${ago == null ? '–' : ago <= 0 ? 'today' : `${ago}d ago`}</button>
      </li>`;
    })}
  </ul>`;
}

export function LineChart({ points, units, onPick, H = 190 }) {
  const W = 640, pl = 44, pr = 16, pt = 14, pb = 26;
  const ws = points.map((p) => p.w);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  if (lo === hi) { lo -= 10; hi += 10; }
  const pad = (hi - lo) * 0.15;
  lo = Math.max(0, Math.floor((lo - pad) / 5) * 5); hi = Math.ceil((hi + pad) / 5) * 5;
  const x = (i) => pl + (points.length === 1 ? (W - pl - pr) / 2 : (i / (points.length - 1)) * (W - pl - pr));
  const y = (w) => pt + (1 - (w - lo) / (hi - lo)) * (H - pt - pb);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join('');
  const last = points.length - 1;
  return html`<div class="chart-wrap"><svg viewBox=${`0 0 ${W} ${H}`} class="chart" role="img" aria-label="Top set over time">
    ${[lo, (lo + hi) / 2, hi].map((t) => html`<g><line x1=${pl} x2=${W - pr} y1=${y(t)} y2=${y(t)} class="grid" /><text x=${pl - 8} y=${y(t) + 4} class="axis" text-anchor="end">${Math.round(t)}</text></g>`)}
    <path d=${`${path}L${x(last).toFixed(1)},${H - pb}L${x(0).toFixed(1)},${H - pb}Z`} class="area" />
    <path d=${path} class="line" />
    ${points.map((p, i) => html`<circle cx=${x(i)} cy=${y(p.w)} r=${i === last ? 5 : 3.5} class=${`pt ${i === last ? 'end' : ''} ${onPick ? 'pt-btn' : ''}`}
        onClick=${onPick ? () => onPick(p.k) : null}><title>${fmtDate(p.k)}: ${p.w}${p.r ? ` × ${p.r}` : ''} ${units}</title></circle>`)}
    ${points.length > 1 && html`<text x=${x(0)} y=${H - 6} class="axis" text-anchor="start">${fmtDate(points[0].k, { month: 'short', day: 'numeric' })}</text>`}
    <text x=${x(last)} y=${H - 6} class="axis" text-anchor=${points.length > 1 ? 'end' : 'middle'}>${fmtDate(points[last].k, { month: 'short', day: 'numeric' })}</text>
  </svg></div>`;
}


const blankPlan = () => ({ id: '', title: '', cat: 'gym', location: '', duration: 60, parts: [{ name: 'Exercises', rest: 90, items: [] }] });
const newItem = () => ({ id: uid('i'), name: '', kind: 'reps', load: true, rx: '3x10', weight: null, muscle: '' });

// Program sessions carry a prescription per week; workouts built here use one sets x reps target and an optional weight.
function PlanEditor({ store, plan, wk, onClose }) {
  const [s, setS] = useState(() => structuredClone(plan));
  const names = useMemo(() => Object.values(M.liftHistory(store)).map((h) => h.name).sort(), []);
  const setPart = (pi, patch) => setS((x) => ({ ...x, parts: x.parts.map((p, i) => (i === pi ? { ...p, ...patch } : p)) }));
  const setItem = (pi, ii, patch) => setPart(pi, { items: s.parts[pi].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const move = (pi, ii, d) => {
    const items = [...s.parts[pi].items];
    if (ii + d < 0 || ii + d >= items.length) return;
    [items[ii], items[ii + d]] = [items[ii + d], items[ii]];
    setPart(pi, { items });
  };

  const save = () => {
    const title = s.title.trim();
    if (!title) return;
    let id = s.id || slug(title);
    if (!s.id) { const base = id; let n = 2; while (store.get('sessions', id)) id = `${base}-${n++}`; }
    const parts = s.parts.map((p) => ({ ...p, items: p.items.filter((it) => it.name.trim()).map((it) => ({ ...it, name: it.name.trim(), muscle: it.muscle || guessMuscle(it.name) || undefined })) }));
    store.put('sessions', id, { ...s, id, title, parts });
    toast(`Saved ${title}`);
    onClose();
  };
  const del = () => {
    if (!confirm(`Delete ${s.title}? Past logs stay.`)) return;
    store.del('sessions', s.id);
    toast(`Deleted ${s.title}`);
    onClose();
  };

  return html`<${Sheet} open full modal title=${s.id ? 'Edit workout' : 'New workout'} onClose=${onClose}
      footer=${html`${s.id && html`<${Btn} kind="danger" icon="trash" onClick=${del}>Delete</${Btn}>`}<span class="grow"></span>
        <${Btn} kind="quiet" onClick=${onClose}>Cancel</${Btn}><${Btn} kind="primary" onClick=${save} disabled=${!s.title.trim()}>Save</${Btn}>`}>
    <div class="form-grid">
      <${Field} label="Name" class="span-2"><input data-autofocus value=${s.title} onInput=${(e) => setS((x) => ({ ...x, title: e.target.value }))} placeholder="Push day" /></${Field}>
      <${Field} label="Where"><input value=${s.location || ''} onInput=${(e) => setS((x) => ({ ...x, location: e.target.value }))} placeholder="YMCA" /></${Field}>
      <${Field} label="Minutes"><input type="number" inputmode="numeric" min="5" step="5" value=${s.duration} onInput=${(e) => setS((x) => ({ ...x, duration: +e.target.value || 60 }))} /></${Field}>
    </div>
    <datalist id="kp-plan-names">${names.map((n) => html`<option value=${n} />`)}</datalist>
    ${s.parts.map((p, pi) => html`<div class="pe-part">
      ${s.parts.length > 1 && html`<h3 class="sub">${p.name}</h3>`}
      ${p.items.map((it, ii) => {
        const rx = parseRx(it.rx || '');
        const timed = it.kind === 'time';
        const setRx = (sets, n) => setItem(pi, ii, { rx: timed ? `${sets || 1}x${n || 30} sec` : `${sets || 1}x${n || 10}` });
        return html`<div class="pe-row" key=${it.id}>
          <div class="pe-name">
            <input list="kp-plan-names" value=${it.name} onInput=${(e) => setItem(pi, ii, { name: e.target.value })} placeholder="Exercise" aria-label="Exercise name" />
            <span class="pe-tools">
              <button type="button" class="icon-btn sm" onClick=${() => move(pi, ii, -1)} aria-label="Move up"><${Icon} name="up" size=${16} /></button>
              <button type="button" class="icon-btn sm" onClick=${() => move(pi, ii, 1)} aria-label="Move down"><${Icon} name="down" size=${16} /></button>
              <button type="button" class="icon-btn sm" onClick=${() => setPart(pi, { items: p.items.filter((_, j) => j !== ii) })} aria-label="Remove exercise"><${Icon} name="trash" size=${16} /></button>
            </span>
          </div>
          ${it.byWeek ? html`<div class="pe-weeks">
              ${it.byWeek.map((v, w) => html`<label class=${w + 1 === wk ? 'now' : ''}><span>Wk${w + 1}</span><input value=${v} onInput=${(e) => { const byWeek = [...it.byWeek]; byWeek[w] = e.target.value; setItem(pi, ii, { byWeek }); }} /></label>`)}
            </div>`
            : it.kind === 'check' ? null
            : html`<div class="pe-nums">
              <label><span>Sets</span><input type="number" inputmode="numeric" min="1" value=${rx.sets ?? ''} onInput=${(e) => setRx(+e.target.value, timed ? rx.secs : rx.reps)} /></label>
              <label><span>${timed ? 'Seconds' : 'Reps'}</span><input type="number" inputmode="numeric" min="1" value=${(timed ? rx.secs : rx.reps) ?? ''} onInput=${(e) => setRx(rx.sets, +e.target.value)} /></label>
              ${!timed && html`<label><span>Weight</span><input type="number" inputmode="decimal" min="0" step="2.5" value=${it.weight ?? ''} placeholder="BW" onInput=${(e) => setItem(pi, ii, { weight: e.target.value === '' ? null : +e.target.value })} /></label>`}
            </div>`}
          <div class="pe-opts">
            <select value=${it.muscle || ''} onChange=${(e) => setItem(pi, ii, { muscle: e.target.value })} aria-label="Muscle">
              <option value="">${guessMuscle(it.name) ? `Muscle: ${guessMuscle(it.name)}` : 'Muscle'}</option>
              ${MUSCLES.map((m) => html`<option value=${m}>${m}</option>`)}
            </select>
            ${!it.byWeek && it.kind !== 'check' && html`<select value=${it.kind} onChange=${(e) => { const kind = e.target.value; setItem(pi, ii, { kind, load: kind === 'reps', rx: kind === 'time' ? `${rx.sets || 3}x30 sec` : `${rx.sets || 3}x10` }); }} aria-label="Type">
              <option value="reps">Reps</option><option value="time">Timed</option>
            </select>`}
          </div>
        </div>`;
      })}
      <${Btn} kind="quiet" icon="plus" onClick=${() => setPart(pi, { items: [...p.items, newItem()] })}>Add exercise</${Btn}>
    </div>`)}
  </${Sheet}>`;
}
