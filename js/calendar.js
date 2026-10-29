import { html, useState, useEffect, useRef, useMemo } from './lib.js';
import {
  CATS, DOW, DOW_LABEL, DOW_LONG, addDays, clamp, dow, fmtDate, fmtDur, fmtRange, fmtTime, fromMin, isTraining,
  layoutDay, nowMin, parseKey, parseQuick, programWeek, rangeKeys, snap, startOfWeek, toMin, todayKey, uid,
} from './util.js';
import { Icon, Btn, Sheet, Field, CatPicker, Segmented, toast } from './ui.js';
import * as M from './model.js';
import { ls } from './store.js';
import { DayTrack } from './workout.js';

const HOUR = 52;

export function CalendarView({ store, date, setDate, view, setView, actions, wide }) {
  const settings = M.getSettings(store);
  const program = M.getProgram(store);
  const today = todayKey();
  const ws = settings.weekStart ?? 1;
  const days = useMemo(() => {
    if (view === 'day') return [date];
    if (view === '3day') return [date, addDays(date, 1), addDays(date, 2)];
    if (view === 'week') { const s = startOfWeek(date, ws); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
    return [];
  }, [date, view, ws]);

  const step = (dir) => {
    if (view === 'month') { const d = parseKey(date); d.setMonth(d.getMonth() + dir, 1); setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); }
    else setDate(addDays(date, dir * (view === 'day' ? 1 : view === '3day' ? 3 : 7)));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.sheet-wrap')) return;
      const k = e.key.toLowerCase();
      if (k === 't') setDate(today);
      else if (k === 'arrowleft') step(-1);
      else if (k === 'arrowright') step(1);
      else if (k === 'd') setView('day');
      else if (k === '3') setView('3day');
      else if (k === 'w') setView('week');
      else if (k === 'm') setView('month');
      else if (k === 'n') { const m = Math.min(23 * 60, snap(nowMin() + 30, 60)); actions.openNew(date, m, m + 60); }
      else if (k === '/') { e.preventDefault(); document.getElementById('quick-add')?.focus(); }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const label = view === 'month'
    ? parseKey(date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'day'
      ? fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })
      : `${fmtDate(days[0], { month: 'short', day: 'numeric' })} – ${fmtDate(days[days.length - 1], { month: 'short', day: 'numeric' })}`;
  const pw = programWeek(program, view === 'month' ? today : days[0]);
  const due = M.toLog(store, today, nowMin(), 14).length;

  return html`<section class="cal-view">
    <div class="cal-toolbar">
      <div class="cal-nav">
        <button class="btn btn-quiet" onClick=${() => setDate(today)}>Today</button>
        <button class="icon-btn" onClick=${() => step(-1)} aria-label="Previous"><${Icon} name="left" /></button>
        <button class="icon-btn" onClick=${() => step(1)} aria-label="Next"><${Icon} name="right" /></button>
        <h1 class="cal-label">${label}</h1>
        ${pw && !pw.before && !pw.after && html`<span class=${`wk-chip ${pw.deload ? 'deload' : ''}`}>${pw.deload ? `Wk${pw.wk} · Deload` : `Wk ${pw.wk}/${program.weeks}`}</span>`}
      </div>
      <div class="cal-tools">
        <${Segmented} label="View" value=${view} onChange=${setView}
          options=${[['day', 'Day'], ['3day', '3 day'], ['week', 'Week'], ['month', 'Month']]} />
        <button class="btn btn-quiet" onClick=${() => actions.openFill(view === 'month' ? date : days[0])}><${Icon} name="repeat" size=${18} /><span>Fill weeks</span></button>
        ${due > 0 && html`<button class="btn btn-quiet todo-btn" onClick=${actions.openQueue} title="Blocks that ended without a log"><${Icon} name="list" size=${18} /><span>To log</span><b>${due}</b></button>`}
      </div>
      <${QuickAdd} store=${store} anchor=${date} />
    </div>
    <div class="cal-main">
      ${wide && view !== 'month' && html`<${PresetRail} store=${store} date=${date} actions=${actions} />`}
      ${view === 'month'
        ? html`<${MonthGrid} store=${store} date=${date} today=${today} weekStart=${ws}
            onPick=${(k) => { setDate(k); setView('day'); }} />`
        : html`<${TimeGrid} store=${store} days=${days} view=${view} today=${today} settings=${settings}
            program=${program} actions=${actions} onSwipe=${step} />`}
    </div>
  </section>`;
}

function QuickAdd({ store, anchor }) {
  const [text, setText] = useState('');
  const settings = M.getSettings(store);
  const res = useMemo(() => (text.trim()
    ? parseQuick(text, { today: todayKey(), fallbackDate: anchor, sessions: M.sessionsList(store), lifePresets: settings.lifePresets, defaultRemind: settings.remindDefault ?? 30 })
    : null), [text, anchor, store.version]);

  const add = () => {
    if (!res || res.error) return;
    M.addBlockToDays(store, res.dates, res.block);
    const dates = res.dates;
    toast(`Added ${res.block.title} to ${dates.map((k) => fmtDate(k, { weekday: 'short', day: 'numeric' })).join(', ')}`);
    setText('');
  };

  return html`<form class="quick" onSubmit=${(e) => { e.preventDefault(); add(); }}>
    <${Icon} name="bolt" size=${18} />
    <input id="quick-add" value=${text} onInput=${(e) => setText(e.target.value)} autocomplete="off"
      placeholder="Quick add: thu 4pm legs plyo · study 3-5 · sat 8:30-10:30 pickup" aria-label="Quick add a block" />
    ${res && html`<span class=${`quick-preview ${res.error ? 'err' : ''}`}>
      ${res.error || html`${res.dates.map((k) => fmtDate(k, { weekday: 'short', month: 'short', day: 'numeric' })).join(', ')} · ${fmtRange(res.block.start, res.block.end)} · <b>${res.block.title}</b>${res.block.location ? ` · ${res.block.location}` : ''}`}
    </span>`}
    ${res && !res.error && html`<button class="btn btn-primary btn-sm" type="submit">Add</button>`}
  </form>`;
}

function PresetRail({ store, date, actions }) {
  const sessions = M.sessionsList(store);
  const life = M.getSettings(store).lifePresets || [];
  const drag = (e, kind, id) => { e.dataTransfer.setData('text/kp-preset', JSON.stringify({ kind, id })); e.dataTransfer.effectAllowed = 'copy'; };
  return html`<aside class="preset-rail" aria-label="Presets">
    <p class="rail-hint">Drag onto the calendar, or click to add to ${fmtDate(date, { weekday: 'short' })}</p>
    <h3>Sessions</h3>
    ${sessions.map((s) => html`<button class=${`preset cat-${s.cat}`} draggable="true" onDragStart=${(e) => drag(e, 'session', s.id)}
        onClick=${() => actions.openNew(date, null, null, { kind: 'session', id: s.id })}>
      <span class="preset-dot"></span><span class="preset-name">${s.title}</span><span class="preset-dur">${fmtDur(s.duration || 60)}</span>
    </button>`)}
    <h3>Life</h3>
    ${life.map((p) => html`<button class=${`preset cat-${p.cat}`} draggable="true" onDragStart=${(e) => drag(e, 'life', p.id)}
        onClick=${() => actions.openNew(date, null, null, { kind: 'life', id: p.id })}>
      <span class="preset-dot"></span><span class="preset-name">${p.title}</span><span class="preset-dur">${fmtDur(p.dur || 60)}</span>
    </button>`)}
  </aside>`;
}

export function presetBlock(store, preset, startMin) {
  const settings = M.getSettings(store);
  if (preset.kind === 'session') {
    const s = M.getSession(store, preset.id);
    return s ? M.blockFromSession({ ...s, id: preset.id }, settings, startMin) : null;
  }
  const p = (settings.lifePresets || []).find((x) => x.id === preset.id);
  return p ? M.blockFromLife(p, startMin) : null;
}

function TimeGrid({ store, days, view, today, settings, program, actions, onSwipe }) {
  const gs = settings.gridStart ?? 6, ge = settings.gridEnd ?? 24;
  const scrollRef = useRef();
  const dragRef = useRef(null);
  const viewRef = useRef(null);
  const [drag, setDragState] = useState(null);
  const [dropHint, setDropHint] = useState(null);
  const [now, setNow] = useState(nowMin());
  const show = (d) => { viewRef.current = d; setDragState(d); };

  useEffect(() => { const id = setInterval(() => setNow(nowMin()), 60000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = days.includes(today) ? Math.max(gs * 60, nowMin() - 90) : 7 * 60;
    el.scrollTop = Math.max(0, ((target - gs * 60) / 60) * HOUR);
  }, [view, days[0]]);

  // While a block is held, stop the page from scrolling under the finger.
  useEffect(() => {
    const el = scrollRef.current;
    const onTouchMove = (e) => { if (dragRef.current?.active) e.preventDefault(); };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  useEffect(() => {
    if (view === 'week') return;
    const el = scrollRef.current;
    let sx = 0, sy = 0, st = 0;
    const start = (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); };
    const end = (e) => {
      if (dragRef.current?.active) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Date.now() - st < 600) onSwipe(dx < 0 ? 1 : -1);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end); };
  }, [view, onSwipe]);

  const minAt = (clientY, col) => gs * 60 + ((clientY - col.getBoundingClientRect().top) / HOUR) * 60;
  const colAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-day]');

  useEffect(() => {
    const move = (e) => {
      const st = dragRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      const dist = Math.hypot(e.clientX - st.x, e.clientY - st.y);
      if (!st.active) {
        if (dist > 8) { clearTimeout(st.timer); dragRef.current = null; }
        return;
      }
      if (dist > 4) st.moved = true;
      if (!st.moved) return;
      if (st.type === 'create') {
        st.b = clamp(snap(minAt(e.clientY, st.col), 15), 0, 1440);
        show({ type: 'create', day: st.day, start: Math.min(st.a, st.b), end: Math.max(st.a, st.b) });
      } else if (st.type === 'move') {
        const col = colAt(e.clientX, e.clientY) || st.col;
        const s = clamp(snap(minAt(e.clientY, col) - st.grab, 15), 0, 1440 - st.len);
        show({ type: 'move', id: st.block.id, day: col.dataset.day || st.day, start: s, end: s + st.len, block: st.block });
      } else if (st.type === 'resize') {
        const end = clamp(snap(minAt(e.clientY, st.col), 15), st.start + 15, 1440);
        show({ type: 'resize', id: st.block.id, day: st.day, start: st.start, end, block: st.block });
      }
    };
    const up = (e) => {
      const st = dragRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      clearTimeout(st.timer);
      dragRef.current = null;
      const d = viewRef.current;
      show(null);
      if (st.type === 'create') {
        if (!st.moved || !d || d.end - d.start < 15) {
          if (st.active || Date.now() - st.t < 600) { const m = clamp(snap(st.a - 15, 30), 0, 1380); actions.openNew(st.day, m, m + 60); }
        } else actions.openNew(st.day, d.start, d.end);
        return;
      }
      if (!st.moved || !d) {
        if (!st.lifted) actions.openBlock(st.day, st.block.id);
        return;
      }
      const original = st.block;
      const next = { ...original, start: fromMin(d.start), end: fromMin(d.end) };
      if (d.day !== st.day) { M.removeBlock(store, st.day, original.id); M.upsertBlock(store, d.day, next); }
      else M.upsertBlock(store, st.day, next);
      toast(`${original.title}: ${d.day !== st.day ? fmtDate(d.day) + ' ' : ''}${fmtRange(next.start, next.end)}`, {
        action: 'Undo',
        onAction: () => {
          if (d.day !== st.day) { M.removeBlock(store, d.day, original.id); M.upsertBlock(store, st.day, original); }
          else M.upsertBlock(store, st.day, original);
        },
      });
    };
    const cancel = (e) => {
      const st = dragRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      clearTimeout(st.timer);
      dragRef.current = null;
      show(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  });

  const onColDown = (e, day) => {
    if (e.target.closest('.blk') || (e.button !== undefined && e.button !== 0)) return;
    const col = e.currentTarget;
    const m = clamp(snap(minAt(e.clientY, col), 15), 0, 1440);
    const mouse = e.pointerType === 'mouse';
    dragRef.current = { type: 'create', pointerId: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), day, a: m, b: m, col, moved: false, active: mouse };
    if (mouse) col.setPointerCapture?.(e.pointerId);
  };

  const onBlockDown = (e, day, block, mode) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    const col = e.currentTarget.closest('[data-day]');
    const s = toMin(block.start), len = Math.max(15, toMin(block.end) - s);
    const mouse = e.pointerType === 'mouse';
    const st = { type: mode, pointerId: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), day, block, col, len, start: s,
      grab: minAt(e.clientY, col) - s, moved: false, active: mouse || mode === 'resize' };
    dragRef.current = st;
    if (st.active) { col.setPointerCapture?.(e.pointerId); return; }
    st.timer = setTimeout(() => {
      if (dragRef.current !== st) return;
      st.active = true; st.lifted = true;
      navigator.vibrate?.(12);
      show({ type: 'move', id: block.id, day, start: s, end: s + len, block, lifted: true });
    }, 380);
  };

  const onDragOver = (e, day) => {
    if (!e.dataTransfer.types.includes('text/kp-preset')) return;
    e.preventDefault();
    setDropHint({ day, m: clamp(snap(minAt(e.clientY, e.currentTarget), 15), 0, 1425) });
  };
  const onDrop = (e, day) => {
    const raw = e.dataTransfer.getData('text/kp-preset');
    setDropHint(null);
    if (!raw) return;
    e.preventDefault();
    const blk = presetBlock(store, JSON.parse(raw), clamp(snap(minAt(e.clientY, e.currentTarget), 15), 0, 1425));
    if (!blk) return;
    M.upsertBlock(store, day, blk);
    toast(`Added ${blk.title} · ${fmtRange(blk.start, blk.end)}`, { action: 'Undo', onAction: () => M.removeBlock(store, day, blk.id) });
  };

  const hours = [];
  for (let h = gs; h < ge; h++) hours.push(h);
  const n = days.length;
  const cols = `52px repeat(${n}, minmax(${view === 'week' ? 92 : 0}px, 1fr))`;

  return html`<div class=${`cal-scroll view-${view}`} ref=${scrollRef}>
    <div class="cal-head" style=${`grid-template-columns:${cols}`}>
      <div class="cal-corner"></div>
      ${days.map((k) => html`<${DayHead} store=${store} k=${k} today=${today} program=${program} view=${view} onOpen=${() => actions.openDay(k)} />`)}
    </div>
    ${view === 'day' && html`<${DayBanner} store=${store} k=${days[0]} actions=${actions} />`}
    <div class="cal-body" style=${`grid-template-columns:${cols};height:${(ge - gs) * HOUR}px;--hour:${HOUR}px`}>
      <div class="cal-gutter">${hours.map((h) => html`<span style=${`top:${(h - gs) * HOUR}px`}>${h === gs ? '' : fmtTime(h * 60)}</span>`)}</div>
      ${days.map((k) => {
        const day = M.getDay(store, k);
        const log = M.getLog(store, k);
        const laid = layoutDay(day.blocks);
        return html`<div class=${`cal-col ${k === today ? 'is-today' : ''} ${k < today ? 'is-past' : ''}`} data-day=${k}
            onPointerDown=${(e) => onColDown(e, k)} onDragOver=${(e) => onDragOver(e, k)} onDragLeave=${() => setDropHint(null)} onDrop=${(e) => onDrop(e, k)}>
          ${laid.map((it) => html`<${Blk} it=${it} gs=${gs} status=${log.blocks?.[it.b.id]?.status}
              due=${!log.blocks?.[it.b.id]?.status && M.isTracked(it.b) && (k < today || (k === today && toMin(it.b.end) <= now))}
              ghost=${!!drag && drag.id === it.b.id}
              onDown=${(e, mode) => onBlockDown(e, k, it.b, mode)} onOpen=${() => actions.openBlock(k, it.b.id)} />`)}
          ${drag && drag.day === k && html`<div class=${`blk blk-preview cat-${drag.block?.cat || 'life'} ${drag.block && isTraining(drag.block.cat) ? 'blk-train' : 'blk-life'}`}
              style=${`top:${((drag.start - gs * 60) / 60) * HOUR}px;height:${Math.max(16, ((drag.end - drag.start) / 60) * HOUR - 2)}px;left:1px;right:2px`}>
            <div class="blk-title">${drag.block?.title || 'New block'}</div><div class="blk-meta">${fmtRange(fromMin(drag.start), fromMin(drag.end))}</div>
          </div>`}
          ${dropHint && dropHint.day === k && html`<div class="drop-line" style=${`top:${((dropHint.m - gs * 60) / 60) * HOUR}px`}><span>${fmtTime(dropHint.m)}</span></div>`}
          ${k === today && now >= gs * 60 && now <= ge * 60 && html`<div class="now-line" style=${`top:${((now - gs * 60) / 60) * HOUR}px`}></div>`}
        </div>`;
      })}
    </div>
  </div>`;
}

function DayHead({ store, k, today, program, view, onOpen }) {
  const day = M.getDay(store, k);
  const pw = programWeek(program, k);
  const tm = M.trainingMinutes(day.blocks);
  const s = M.dayStats(store, k);
  const started = k <= today && s.planned > 0;
  const showWk = pw && !pw.before && !pw.after && (view === 'day' || program.start && dow(k) === dow(program.start));
  return html`<button class=${`cal-dh ${k === today ? 'is-today' : ''}`} onClick=${onOpen}
      aria-label=${`${fmtDate(k, { weekday: 'long', month: 'long', day: 'numeric' })}: ${s.planned ? `${s.done + s.partial} of ${s.planned} logged` : 'day details'}`}>
    <span class="dh-dow">${DOW_LABEL[dow(k)]}</span>
    <span class="dh-num">${parseKey(k).getDate()}</span>
    <span class="dh-tags">
      ${showWk && html`<span class=${`wk-chip sm ${pw.deload ? 'deload' : ''}`}>${pw.deload ? 'Deload' : `Wk${pw.wk}`}</span>`}
      ${day.note && html`<span class="dh-note" title=${day.note}><${Icon} name="note" size=${12} /></span>`}
      ${started ? html`<span class=${`dh-score ${s.pct === 1 ? 'full' : ''}`}>${s.done + s.partial}/${s.planned}</span>`
        : tm > 0 && html`<span class="dh-load">${fmtDur(tm)}</span>`}
    </span>
    ${started && html`<span class="dh-bar" aria-hidden="true"><i class="done" style=${`width:${(s.done / s.planned) * 100}%`}></i><i class="partial" style=${`width:${(s.partial / s.planned) * 100}%`}></i><i class="skip" style=${`width:${(s.skipped / s.planned) * 100}%`}></i></span>`}
  </button>`;
}

function DayBanner({ store, k, actions }) {
  const day = M.getDay(store, k);
  const tpl = M.templatesList(store)[0];
  if (!day.blocks.length) {
    return html`<div class="day-banner empty-day">
      <span>Nothing planned for ${fmtDate(k, { weekday: 'long' })} yet.</span>
      ${tpl && html`<button class="btn btn-quiet btn-sm" onClick=${() => { M.applyTemplate(store, tpl, [k], { mode: 'empty' }); toast(`Filled from ${tpl.name}`); }}>Fill from ${tpl.name}</button>`}
      <button class="btn btn-quiet btn-sm" onClick=${() => actions.openDay(k)}>Paste or add a note</button>
    </div>`;
  }
  if (!day.note) return null;
  return html`<button class="day-banner" onClick=${() => actions.openDay(k)}><${Icon} name="note" size=${16} /><span>${day.note}</span></button>`;
}

const ST_MARK = { done: html`<${Icon} name="check" size=${11} />`, partial: '½', skipped: html`<${Icon} name="x" size=${11} />` };
const ST_WORD = { done: 'done', partial: 'half done', skipped: 'skipped' };

function Blk({ it, gs, status, due, ghost, onDown, onOpen }) {
  const b = it.b;
  const top = ((it.s - gs * 60) / 60) * HOUR;
  const h = Math.max(16, ((it.e - it.s) / 60) * HOUR - 2);
  const train = isTraining(b.cat);
  const style = `top:${top}px;height:${h}px;left:calc(${(it.col / it.ncol) * 100}% + 1px);width:calc(${100 / it.ncol}% - 3px)`;
  return html`<div class=${`blk cat-${b.cat} ${train ? 'blk-train' : 'blk-life'} ${h < 36 ? 'blk-tiny' : ''} ${status ? `st-${status}` : ''} ${due ? 'blk-due' : ''} ${ghost ? 'blk-ghost' : ''}`}
      style=${style} role="button" tabindex="0" aria-label=${`${b.title}, ${fmtRange(b.start, b.end)}${status ? `, ${ST_WORD[status]}` : due ? ', not logged' : ''}`}
      onPointerDown=${(e) => onDown(e, 'move')} onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onContextMenu=${(e) => e.preventDefault()}>
    ${(status || due) && html`<span class=${`blk-st ${status ? `st-${status}` : 'due'}`} aria-hidden="true">${status ? ST_MARK[status] : '!'}</span>`}
    <div class="blk-title">${b.title}</div>
    <div class="blk-meta">${fmtRange(b.start, b.end)}${b.location ? ` · ${b.location}` : ''}</div>
    <div class="blk-resize" onPointerDown=${(e) => onDown(e, 'resize')} aria-hidden="true"></div>
  </div>`;
}

function MonthGrid({ store, date, today, weekStart, onPick }) {
  const first = date.slice(0, 8) + '01';
  const start = startOfWeek(first, weekStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const month = first.slice(0, 7);
  const program = M.getProgram(store);
  const heads = Array.from({ length: 7 }, (_, i) => DOW_LABEL[(weekStart + i) % 7]);
  return html`<div class="month">
    ${heads.map((h) => html`<div class="month-h">${h}</div>`)}
    ${cells.map((k) => {
      const day = M.getDay(store, k);
      const log = M.getLog(store, k);
      const train = day.blocks.filter((b) => isTraining(b.cat) && b.sessionId !== 'flex-light');
      const pw = programWeek(program, k);
      const s = k <= today ? M.dayStats(store, k) : null;
      const pct = s?.planned ? Math.round(s.pct * 100) : null;
      return html`<button class=${`month-cell ${k.slice(0, 7) !== month ? 'out' : ''} ${k === today ? 'is-today' : ''} ${pw?.deload ? 'deload' : ''} ${pct != null ? 'has-pct' : ''}`}
          style=${pct != null ? `--pct:${pct}%` : ''} onClick=${() => onPick(k)}
          aria-label=${`${fmtDate(k, { weekday: 'long', month: 'long', day: 'numeric' })}${pct != null ? `, ${s.done + s.partial} of ${s.planned} logged` : ''}`}>
        <span class="month-num">${parseKey(k).getDate()}</span>
        ${pct != null && html`<span class=${`month-pct ${pct === 100 ? 'full' : s.open ? 'due' : ''}`}>${s.done + s.partial}/${s.planned}</span>`}
        ${day.note && html`<span class="month-note"><${Icon} name="note" size=${11} /></span>`}
        <span class="month-items">
          ${train.slice(0, 3).map((b) => html`<span class=${`month-item cat-${b.cat} ${log.blocks?.[b.id]?.status ? `st-${log.blocks[b.id].status}` : ''}`}>${b.title}</span>`)}
          ${train.length > 3 && html`<span class="month-more">+${train.length - 3}</span>`}
        </span>
      </button>`;
    })}
  </div>`;
}

const REMIND_OPTS = [[null, 'Off'], [0, 'At start'], [5, '5 min before'], [10, '10 min before'], [15, '15 min before'], [20, '20 min before'], [25, '25 min before'], [30, '30 min before'], [45, '45 min before'], [60, '1 hour before'], [90, '90 min before']];

export function BlockEditor({ store, state, onClose }) {
  const settings = M.getSettings(store);
  const sessions = M.sessionsList(store);
  const [f, setF] = useState(() => ({ ...state.block }));
  const [date, setDate] = useState(state.date);
  const [repeat, setRepeat] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const applyPreset = (preset) => {
    const blk = presetBlock(store, preset, toMin(f.start || '16:00'));
    if (blk) setF((x) => ({ ...blk, id: x.id, start: x.start || blk.start, end: preset.keepEnd ? x.end : blk.end, note: x.note || '' }));
  };
  useEffect(() => { if (state.preset) applyPreset(state.preset); }, []);

  const endFor = (e) => (e === '00:00' ? '24:00' : e);
  const valid = f.title?.trim() && f.start && f.end && toMin(endFor(f.end)) > toMin(f.start);

  const save = () => {
    if (!valid) return;
    const blk = { ...f, title: f.title.trim(), end: endFor(f.end) };
    if (!state.isNew && date !== state.date) M.removeBlock(store, state.date, blk.id);
    M.upsertBlock(store, date, blk);
    if (repeat?.days?.length && repeat.until > date) {
      const keys = rangeKeys(addDays(date, 1), repeat.until).filter((k) => repeat.days.includes(DOW[dow(k)]));
      if (keys.length) M.addBlockToDays(store, keys, blk);
      toast(`Saved and repeated on ${keys.length} more day${keys.length === 1 ? '' : 's'}`);
    } else toast(state.isNew ? `Added ${blk.title}` : 'Saved');
    onClose();
  };
  const del = () => {
    const original = M.getDay(store, state.date).blocks.find((b) => b.id === f.id);
    M.removeBlock(store, state.date, f.id);
    toast(`Deleted ${f.title}`, { action: 'Undo', onAction: () => original && M.upsertBlock(store, state.date, original) });
    onClose();
  };
  const duplicate = () => {
    const copy = { ...f, id: uid(), end: endFor(f.end) };
    M.upsertBlock(store, date, copy);
    toast('Duplicated');
    onClose();
  };

  const linked = f.sessionId && M.getSession(store, f.sessionId);
  return html`<${Sheet} open title=${state.isNew ? 'New block' : 'Edit block'} onClose=${onClose}
      footer=${html`
        ${!state.isNew && html`<${Btn} kind="danger" icon="trash" onClick=${del}>Delete</${Btn}>`}
        ${!state.isNew && html`<${Btn} kind="quiet" icon="copy" onClick=${duplicate}>Duplicate</${Btn}>`}
        <span class="grow"></span>
        <${Btn} kind="quiet" onClick=${onClose}>Cancel</${Btn}>
        <${Btn} kind="primary" onClick=${save} disabled=${!valid}>Save</${Btn}>`}>
    ${state.isNew && html`<div class="preset-chips" aria-label="Presets">
      ${sessions.map((s) => html`<button type="button" class=${`chip cat-${s.cat} ${f.sessionId === s.id ? 'on' : ''}`} onClick=${() => applyPreset({ kind: 'session', id: s.id, keepEnd: false })}>${s.title}</button>`)}
      ${(settings.lifePresets || []).map((p) => html`<button type="button" class=${`chip cat-${p.cat} ${!f.sessionId && f.title === p.title ? 'on' : ''}`} onClick=${() => applyPreset({ kind: 'life', id: p.id })}>${p.title}</button>`)}
    </div>`}
    <div class="form-grid">
      <${Field} label="Title" class="span-2"><input data-autofocus value=${f.title || ''} onInput=${(e) => set({ title: e.target.value })} placeholder="What is it?" /></${Field}>
      <${Field} label="Category" class="span-2"><${CatPicker} value=${f.cat} onChange=${(cat) => set({ cat })} /></${Field}>
      <${Field} label="Date"><input type="date" value=${date} onInput=${(e) => e.target.value && setDate(e.target.value)} /></${Field}>
      <${Field} label="Session plan">
        <select value=${f.sessionId || ''} onChange=${(e) => {
          const s = e.target.value && M.getSession(store, e.target.value);
          set(s ? { sessionId: e.target.value, title: f.title || s.title, cat: s.cat, location: f.location || s.location || '' } : { sessionId: null });
        }}>
          <option value="">None</option>
          ${sessions.map((s) => html`<option value=${s.id}>${s.title}</option>`)}
        </select>
      </${Field}>
      <${Field} label="Start"><input type="time" step="300" value=${f.start || ''} onInput=${(e) => {
        const ns = e.target.value; if (!ns) return;
        const len = toMin(endFor(f.end || '00:00')) - toMin(f.start || ns);
        set({ start: ns, end: fromMin(Math.min(1440, toMin(ns) + (len > 0 ? len : 60))) });
      }} /></${Field}>
      <${Field} label="End"><input type="time" step="300" value=${f.end === '24:00' ? '00:00' : f.end || ''} onInput=${(e) => set({ end: e.target.value })} /></${Field}>
      <${Field} label="Location"><input value=${f.location || ''} onInput=${(e) => set({ location: e.target.value })} placeholder="YMCA, home gym, field" /></${Field}>
      <${Field} label="Reminder">
        <select value=${f.remind == null ? '' : String(f.remind)} onChange=${(e) => set({ remind: e.target.value === '' ? null : +e.target.value })}>
          ${REMIND_OPTS.map(([v, l]) => html`<option value=${v == null ? '' : String(v)}>${l}</option>`)}
        </select>
      </${Field}>
      ${f.remind != null && html`<${Field} label="Reminder note" class="span-2"><input value=${f.remindNote || ''} onInput=${(e) => set({ remindNote: e.target.value })} placeholder="Leave by 3:50" /></${Field}>`}
      <${Field} label="Instructions for this block" class="span-2" hint=${linked ? `The ${linked.title} plan shows with it automatically.` : ''}>
        <textarea rows="3" value=${f.note || ''} onInput=${(e) => set({ note: e.target.value })} placeholder="e.g. Keep it light, ankle is sore"></textarea>
      </${Field}>
    </div>
    <details class="repeat" open=${!!repeat}>
      <summary><${Icon} name="repeat" size=${16} /> Repeat on other days</summary>
      <div class="repeat-row">
        ${[1, 2, 3, 4, 5, 6, 0].map((i) => {
          const d = DOW[i], on = repeat?.days?.includes(d);
          return html`<button type="button" class=${`chip ${on ? 'on' : ''}`} onClick=${() => setRepeat((r) => {
            const days = r?.days || [];
            return { until: r?.until || addDays(date, 27), days: on ? days.filter((x) => x !== d) : [...days, d] };
          })}>${DOW_LABEL[i]}</button>`;
        })}
        <label class="inline">until <input type="date" value=${repeat?.until || addDays(date, 27)} onInput=${(e) => setRepeat((r) => ({ days: r?.days || [], until: e.target.value }))} /></label>
      </div>
    </details>
  </${Sheet}>`;
}

const NOTE_CHIPS = ['Deload: keep RPE ≤ 6', 'Game day: warm-up only', 'Rest day: walk + stretch', 'Exam day: shorter session', 'Sore: swap plyo for mobility', 'Travel day'];
const CLIP_KEY = 'kp:dayclip';

export function DaySheet({ store, date, onClose, onGo, actions }) {
  const day = M.getDay(store, date);
  const program = M.getProgram(store);
  const pw = programWeek(program, date);
  const [note, setNote] = useState(day.note || '');
  const tpls = M.templatesList(store);
  const clip = ls.get(CLIP_KEY);
  const saveNote = (v) => { if (v !== (day.note || '')) M.saveDay(store, date, { note: v }); };

  const copy = () => { ls.set(CLIP_KEY, { from: date, blocks: day.blocks.map(({ id, ...b }) => b), note: day.note || '' }); toast(`Copied ${fmtDate(date)}`); };
  const paste = (replace) => {
    if (!clip) return;
    const log = M.getLog(store, date);
    const kept = replace ? day.blocks.filter((b) => log.blocks?.[b.id]) : day.blocks;
    M.saveDay(store, date, { blocks: [...kept, ...clip.blocks.map((b) => ({ ...b, id: uid() }))] });
    toast(`Pasted ${fmtDate(clip.from)} into ${fmtDate(date)}`);
    onClose();
  };
  const clear = () => {
    const before = day;
    const log = M.getLog(store, date);
    M.saveDay(store, date, { blocks: day.blocks.filter((b) => log.blocks?.[b.id]) });
    toast('Cleared unlogged blocks', { action: 'Undo', onAction: () => store.put('days', date, before) });
    onClose();
  };

  return html`<${Sheet} open title=${fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })} onClose=${() => { saveNote(note); onClose(); }}
      footer=${html`<span class="muted">${pw && !pw.before ? `${program.name} · ${pw.label}` : ''}</span><span class="grow"></span>
        <${Btn} kind="quiet" onClick=${() => { saveNote(note); onGo(date); }}>Open day</${Btn}>
        <${Btn} kind="primary" onClick=${() => { saveNote(note); onClose(); }}>Done</${Btn}>`}>
    ${date <= todayKey() && day.blocks.length > 0 && html`<h3 class="sub">How it went</h3><${DayTrack} store=${store} date=${date} actions=${actions} />`}
    <${Field} label="Instructions for the day" hint="Shows at the top of the day and on the Today tab.">
      <textarea data-autofocus rows="4" value=${note} onInput=${(e) => setNote(e.target.value)} onBlur=${() => saveNote(note)}
        placeholder="e.g. Deload week. Stop every set with 3 reps left."></textarea>
    </${Field}>
    <div class="chip-row">${NOTE_CHIPS.map((c) => html`<button type="button" class="chip" onClick=${() => setNote((n) => (n ? `${n}\n${c}` : c))}>${c}</button>`)}</div>
    <h3 class="sub">Fast changes</h3>
    <div class="action-grid">
      <${Btn} icon="copy" onClick=${copy} disabled=${!day.blocks.length}>Copy this day</${Btn}>
      <${Btn} icon="copy" onClick=${() => paste(false)} disabled=${!clip}>${clip ? `Add blocks from ${fmtDate(clip.from, { weekday: 'short', month: 'short', day: 'numeric' })}` : 'Paste (copy a day first)'}</${Btn}>
      ${clip && html`<${Btn} icon="copy" onClick=${() => paste(true)}>Replace with ${fmtDate(clip.from, { weekday: 'short', day: 'numeric' })}</${Btn}>`}
      ${tpls.map((t) => html`<${Btn} icon="repeat" onClick=${() => { M.applyTemplate(store, t, [date], { mode: 'replace' }); toast(`Reset to ${t.name}`); onClose(); }}>Reset to ${t.name} (${DOW_LONG[dow(date)]})</${Btn}>`)}
      <${Btn} kind="danger" icon="trash" onClick=${clear} disabled=${!day.blocks.length}>Clear unlogged blocks</${Btn}>
    </div>
  </${Sheet}>`;
}

export function FillSheet({ store, from: initialFrom, onClose }) {
  const tpls = M.templatesList(store);
  const settings = M.getSettings(store);
  const program = M.getProgram(store);
  const [tplId, setTplId] = useState(tpls[0]?.id);
  const [from, setFrom] = useState(startOfWeek(initialFrom || todayKey(), settings.weekStart ?? 1));
  const [to, setTo] = useState(() => addDays(startOfWeek(initialFrom || todayKey(), settings.weekStart ?? 1), 27));
  const [wd, setWd] = useState(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  const [mode, setMode] = useState('empty');
  const tpl = tpls.find((t) => t.id === tplId);
  const keys = from && to && to >= from ? rangeKeys(from, to).filter((k) => wd.includes(DOW[dow(k)])) : [];
  const affected = keys.filter((k) => mode === 'replace' || !M.getDay(store, k).blocks.length).length;

  const apply = () => {
    if (!tpl) return;
    const n = M.applyTemplate(store, tpl, keys, { mode });
    toast(`Filled ${n} day${n === 1 ? '' : 's'} from ${tpl.name}`);
    onClose();
  };

  return html`<${Sheet} open title="Fill weeks from a template" onClose=${onClose}
      footer=${html`<span class="muted">${affected} day${affected === 1 ? '' : 's'} will change</span><span class="grow"></span>
        <${Btn} kind="quiet" onClick=${onClose}>Cancel</${Btn}><${Btn} kind="primary" onClick=${apply} disabled=${!tpl || !affected}>Fill</${Btn}>`}>
    ${!tpls.length && html`<p class="muted">No templates yet. Make one in Library → Week template.</p>`}
    <div class="form-grid">
      <${Field} label="Template" class="span-2">
        <select value=${tplId} onChange=${(e) => setTplId(e.target.value)}>${tpls.map((t) => html`<option value=${t.id}>${t.name}</option>`)}</select>
      </${Field}>
      <${Field} label="From"><input type="date" value=${from} onInput=${(e) => setFrom(e.target.value)} /></${Field}>
      <${Field} label="To"><input type="date" value=${to} onInput=${(e) => setTo(e.target.value)} /></${Field}>
    </div>
    ${program && html`<div class="chip-row"><button type="button" class="chip" onClick=${() => { setFrom(program.start); setTo(program.end || addDays(program.start, program.weeks * 7 - 1)); }}>Whole ${program.name}</button>
      <button type="button" class="chip" onClick=${() => { const s = startOfWeek(todayKey(), settings.weekStart ?? 1); setFrom(addDays(s, 7)); setTo(addDays(s, 13)); }}>Next week</button></div>`}
    <h3 class="sub">Days</h3>
    <div class="chip-row">
      ${[1, 2, 3, 4, 5, 6, 0].map((i) => {
        const d = DOW[i], on = wd.includes(d);
        return html`<button type="button" class=${`chip ${on ? 'on' : ''}`} onClick=${() => setWd((x) => (on ? x.filter((y) => y !== d) : [...x, d]))}>${DOW_LABEL[i]}</button>`;
      })}
    </div>
    <h3 class="sub">If a day already has blocks</h3>
    <${Segmented} label="Mode" value=${mode} onChange=${setMode} options=${[['empty', 'Leave it alone'], ['replace', 'Replace it (keeps logged blocks)']]} />
  </${Sheet}>`;
}
