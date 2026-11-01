import { html, useState } from './lib.js';
import { CATS, CAT_ORDER, DOW, DOW_LABEL, addDays, fmtDur, fmtRange, nowMin, rxFor, slug, sortBlocks, startOfWeek, todayKey, toMin, fromMin, uid } from './util.js';
import { Icon, Btn, Sheet, Field, CatPicker, Segmented, Empty, toast } from './ui.js';
import { SessionPlan } from './workout.js';
import * as M from './model.js';

export function LibraryView({ store, actions }) {
  const [tab, setTab] = useState('sessions');
  return html`<section class="library">
    <header class="page-head"><h1>Library</h1>
      <${Segmented} label="Library section" value=${tab} onChange=${setTab}
        options=${[['sessions', 'Sessions'], ['template', 'Week template'], ['presets', 'Quick presets'], ['program', 'Training block']]} />
    </header>
    ${tab === 'sessions' && html`<${Sessions} store=${store} actions=${actions} />`}
    ${tab === 'template' && html`<${TemplateEditor} store=${store} actions=${actions} />`}
    ${tab === 'presets' && html`<${LifePresets} store=${store} />`}
    ${tab === 'program' && html`<${ProgramEditor} store=${store} />`}
  </section>`;
}

function Sessions({ store, actions }) {
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const sessions = M.sessionsList(store);
  const program = M.getProgram(store);
  const [wk, setWk] = useState(1);
  const blank = () => ({ id: '', title: '', cat: 'gym', location: '', duration: 60, parts: [{ name: 'Main', items: [] }] });
  const start = (s) => { const today = todayKey(); actions.openWorkout(today, M.startWorkout(store, today, nowMin(), s.id)); };
  return html`<div>
    <p class="lede">Each session holds its warm-up, drills and lifts with a prescription for every week of the block. Start any of them now, scheduled or not.</p>
    <div class="row-end"><${Btn} kind="primary" icon="plus" onClick=${() => setEditing(blank())}>New session</${Btn}></div>
    ${CAT_ORDER.filter((c) => sessions.some((s) => s.cat === c)).map((c) => html`<div class="lib-group">
      <h3 class=${`lib-cat cat-${c}`}><i class="dot"></i>${CATS[c].label}</h3>
      <div class="lib-list">${sessions.filter((s) => s.cat === c).map((s) => html`<div class="lib-item">
        <button type="button" class="lib-open" onClick=${() => setViewing(s)}>
          <span class="lib-title">${s.title}</span>
          <span class="muted small">${fmtDur(s.duration || 60)}${s.location ? ` · ${s.location}` : ''} · ${(s.parts || []).reduce((n, p) => n + p.items.length, 0)} items</span>
        </button>
        <button type="button" class="icon-btn lib-start" onClick=${() => start(s)} aria-label=${`Start ${s.title} now`} title="Start now"><${Icon} name="play" size=${18} /></button>
      </div>`)}</div>
    </div>`)}
    ${viewing && html`<${Sheet} open wide title=${viewing.title} onClose=${() => setViewing(null)}
        footer=${html`<${Segmented} label="Week" value=${wk} onChange=${setWk} options=${Array.from({ length: program?.weeks || 4 }, (_, i) => [i + 1, `Wk ${i + 1}`])} />
          <span class="grow"></span>
          <${Btn} kind="quiet" icon="copy" onClick=${() => { setEditing({ ...structuredClone(viewing), id: '', title: `${viewing.title} (copy)` }); setViewing(null); }}>Duplicate</${Btn}>
          <${Btn} kind="quiet" icon="edit" onClick=${() => { setEditing(structuredClone(viewing)); setViewing(null); }}>Edit</${Btn}>
          <${Btn} kind="primary" icon="play" onClick=${() => { const s = viewing; setViewing(null); start(s); }}>Start now</${Btn}>`}>
      <${SessionPlan} session=${viewing} wk=${wk} />
    </${Sheet}>`}
    ${editing && html`<${SessionEditor} store=${store} session=${editing} weeks=${program?.weeks || 4} onClose=${() => setEditing(null)} />`}
  </div>`;
}

function SessionEditor({ store, session, weeks, onClose }) {
  const [s, setS] = useState(() => structuredClone(session));
  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  const setPart = (pi, patch) => setS((x) => ({ ...x, parts: x.parts.map((p, i) => (i === pi ? { ...p, ...patch } : p)) }));
  const setItem = (pi, ii, patch) => setPart(pi, { items: s.parts[pi].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const moveItem = (pi, ii, d) => {
    const items = [...s.parts[pi].items];
    const j = ii + d;
    if (j < 0 || j >= items.length) return;
    [items[ii], items[j]] = [items[j], items[ii]];
    setPart(pi, { items });
  };
  const addItem = (pi) => {
    const ids = new Set(s.parts.flatMap((p) => p.items.map((it) => it.id)));
    let id = uid('i');
    while (ids.has(id)) id = uid('i');
    setPart(pi, { items: [...s.parts[pi].items, { id, name: '', kind: 'reps', byWeek: Array(weeks).fill('') }] });
  };

  const save = () => {
    if (!s.title.trim()) return;
    const id = s.id || slug(s.title);
    const clean = { ...s, id, title: s.title.trim(), duration: +s.duration || 60, remind: s.remind == null ? null : Math.max(0, Math.round(+s.remind)),
      parts: s.parts.map((p) => ({ ...p, items: p.items.filter((it) => it.name.trim()).map((it) => ({ ...it, name: it.name.trim(), byWeek: it.byWeek?.some(Boolean) ? it.byWeek : undefined })) })) };
    let finalId = id;
    if (!s.id) { let n = 2; while (store.get('sessions', finalId)) finalId = `${id}-${n++}`; clean.id = finalId; }
    store.put('sessions', finalId, clean);
    toast(`Saved ${clean.title}`);
    onClose();
  };
  const del = () => { store.del('sessions', s.id); toast(`Deleted ${s.title}. Blocks already on the calendar keep their times.`); onClose(); };

  return html`<${Sheet} open full title=${s.id ? `Edit ${session.title}` : 'New session'} onClose=${onClose}
      footer=${html`${s.id && html`<${Btn} kind="danger" icon="trash" onClick=${del}>Delete</${Btn}>`}<span class="grow"></span>
        <${Btn} kind="quiet" onClick=${onClose}>Cancel</${Btn}><${Btn} kind="primary" onClick=${save} disabled=${!s.title.trim()}>Save session</${Btn}>`}>
    <div class="form-grid">
      <${Field} label="Name" class="span-2"><input data-autofocus value=${s.title} onInput=${(e) => set({ title: e.target.value })} /></${Field}>
      <${Field} label="Category" class="span-2" group><${CatPicker} value=${s.cat} onChange=${(cat) => set({ cat })} only=${CAT_ORDER.filter((c) => CATS[c].training)} /></${Field}>
      <${Field} label="Location"><input value=${s.location || ''} onInput=${(e) => set({ location: e.target.value })} /></${Field}>
      <${Field} label="Length (min)"><input type="number" min="5" step="5" value=${s.duration} onInput=${(e) => set({ duration: e.target.value })} /></${Field}>
      <${Field} label="Default reminder (min before, blank = off)"><input type="number" min="0" step="5" value=${s.remind ?? ''} onInput=${(e) => set({ remind: e.target.value === '' ? null : +e.target.value })} /></${Field}>
      <${Field} label="Reminder note"><input value=${s.remindNote || ''} onInput=${(e) => set({ remindNote: e.target.value })} placeholder="Leave by 3:50" /></${Field}>
      <${Field} label="Bring" class="span-2"><input value=${s.bring || ''} onInput=${(e) => set({ bring: e.target.value })} /></${Field}>
      <${Field} label="Notes" class="span-2"><textarea rows="2" value=${s.notes || ''} onInput=${(e) => set({ notes: e.target.value })}></textarea></${Field}>
      <${Field} label="Warm-up" class="span-2"><textarea rows="2" value=${s.warmup || ''} onInput=${(e) => set({ warmup: e.target.value })}></textarea></${Field}>
    </div>
    ${s.parts.map((p, pi) => html`<fieldset class="part-edit">
      <legend><input class="part-name" value=${p.name} onInput=${(e) => setPart(pi, { name: e.target.value })} aria-label="Part name" /></legend>
      <div class="form-grid">
        <${Field} label="Part note"><input value=${p.note || ''} onInput=${(e) => setPart(pi, { note: e.target.value })} /></${Field}>
        <${Field} label="Rest between sets (sec)"><input type="number" min="0" step="15" value=${p.rest ?? ''} onInput=${(e) => setPart(pi, { rest: e.target.value === '' ? undefined : +e.target.value })} /></${Field}>
      </div>
      <div class="items-edit">
        <div class="ie-head" style=${`--weeks:${weeks}`}><span>Exercise or drill</span><span>Type</span>${Array.from({ length: weeks }, (_, w) => html`<span>Wk ${w + 1}</span>`)}<span></span></div>
        ${p.items.map((it, ii) => html`<div class="ie-row" style=${`--weeks:${weeks}`}>
          <span class="ie-name">
            <input value=${it.name} onInput=${(e) => setItem(pi, ii, { name: e.target.value })} placeholder="Exercise" aria-label="Exercise name" />
            <input class="ie-cue" value=${it.cue || ''} onInput=${(e) => setItem(pi, ii, { cue: e.target.value })} placeholder="Cue (optional)" aria-label="Coaching cue" />
          </span>
          <span class="ie-kind">
            <select value=${it.kind} onChange=${(e) => setItem(pi, ii, { kind: e.target.value })} aria-label="Type">
              <option value="reps">Sets × reps</option><option value="time">Timed</option><option value="count">Drill count</option><option value="check">Checkbox</option>
            </select>
            ${it.kind === 'reps' && html`<label class="inline small"><input type="checkbox" checked=${!!it.load} onChange=${(e) => setItem(pi, ii, { load: e.target.checked })} /> weight</label>`}
          </span>
          ${Array.from({ length: weeks }, (_, w) => html`<label class="ie-wk"><span>Wk ${w + 1}</span><input value=${it.byWeek?.[w] || ''} placeholder=${w ? rxFor({ byWeek: it.byWeek?.slice(0, w) }, w) : '3x8'}
              aria-label=${`Week ${w + 1} prescription`}
              onInput=${(e) => { const byWeek = [...(it.byWeek || Array(weeks).fill(''))]; byWeek[w] = e.target.value; setItem(pi, ii, { byWeek }); }} /></label>`)}
          <span class="ie-tools">
            <button type="button" class="icon-btn sm" onClick=${() => moveItem(pi, ii, -1)} aria-label="Move up"><${Icon} name="up" size=${16} /></button>
            <button type="button" class="icon-btn sm" onClick=${() => moveItem(pi, ii, 1)} aria-label="Move down"><${Icon} name="down" size=${16} /></button>
            <button type="button" class="icon-btn sm" onClick=${() => setPart(pi, { items: p.items.filter((_, j) => j !== ii) })} aria-label="Remove"><${Icon} name="x" size=${14} /></button>
          </span>
        </div>`)}
      </div>
      <div class="row-gap">
        <${Btn} kind="quiet" icon="plus" onClick=${() => addItem(pi)}>Add exercise</${Btn}>
        ${s.parts.length > 1 && html`<${Btn} kind="quiet" icon="trash" onClick=${() => setS((x) => ({ ...x, parts: x.parts.filter((_, i) => i !== pi) }))}>Remove part</${Btn}>`}
      </div>
    </fieldset>`)}
    <${Btn} kind="quiet" icon="plus" onClick=${() => setS((x) => ({ ...x, parts: [...x.parts, { name: `Part ${x.parts.length + 1}`, items: [] }] }))}>Add part</${Btn}>
    <${Field} label="Cooldown"><textarea rows="2" value=${s.cooldown || ''} onInput=${(e) => set({ cooldown: e.target.value })}></textarea></${Field}>
    <p class="muted small">Prescriptions like 4x8, 3x6-8, 3x45 sec/side, 12/side or “—” (not this week) turn into tap-to-log sets.</p>
  </${Sheet}>`;
}

const WD = [1, 2, 3, 4, 5, 6, 0];
const dayLabel = (k) => DOW_LABEL[DOW.indexOf(k)];

function TemplateEditor({ store, actions }) {
  const tpls = M.templatesList(store);
  const [tplId, setTplId] = useState(tpls[0]?.id);
  const tpl = tpls.find((t) => t.id === tplId) || tpls[0];
  const [d, setD] = useState('mon');
  const sessions = M.sessionsList(store);
  const settings = M.getSettings(store);

  if (!tpl) return html`<${Empty} title="No templates">Save a calendar week as a template to start.</${Empty}>`;
  const blocks = sortBlocks(tpl.days?.[d] || []);
  const save = (days) => store.put('templates', tpl.id, { ...tpl, days });
  const setBlocks = (bs) => save({ ...tpl.days, [d]: sortBlocks(bs) });
  const setB = (i, patch) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const saveCurrentWeek = () => {
    const s = startOfWeek(todayKey(), settings.weekStart ?? 1);
    const keys = Array.from({ length: 7 }, (_, i) => addDays(s, i));
    const t = M.weekToTemplate(store, keys, tpl);
    store.put('templates', tpl.id, t);
    toast(`${tpl.name} now matches this week`);
  };
  const copyTo = (targets) => {
    const days = { ...tpl.days };
    for (const t of targets) days[t] = blocks.map((b) => ({ ...b }));
    save(days);
    toast(`Copied ${dayLabel(d)} to ${targets.map(dayLabel).join(', ')}`);
  };

  return html`<div>
    <p class="lede">The standard week the calendar is filled from. Changing it doesn’t touch days already on the calendar until you fill them again.</p>
    <div class="row-gap wrap">
      ${tpls.length > 1 && html`<select value=${tpl.id} onChange=${(e) => setTplId(e.target.value)}>${tpls.map((t) => html`<option value=${t.id}>${t.name}</option>`)}</select>`}
      <${Btn} kind="quiet" onClick=${saveCurrentWeek}>Replace with this calendar week</${Btn}>
      <${Btn} kind="quiet" onClick=${() => actions.openFill(todayKey())}>Fill the calendar from it</${Btn}>
    </div>
    <div class="day-tabs" role="tablist">
      ${WD.map((i) => html`<button role="tab" aria-selected=${d === DOW[i]} class=${d === DOW[i] ? 'on' : ''} onClick=${() => setD(DOW[i])}>${DOW_LABEL[i]}
        <small>${(tpl.days?.[DOW[i]] || []).filter((b) => CATS[b.cat]?.training).length}</small></button>`)}
    </div>
    <div class="tpl-rows">
      ${blocks.map((b, i) => html`<div class=${`tpl-row cat-${b.cat}`}>
        <i class="dot"></i>
        <input type="time" value=${b.start} onChange=${(e) => setB(i, { start: e.target.value })} aria-label="Start" />
        <input type="time" value=${b.end === '24:00' ? '00:00' : b.end} onChange=${(e) => setB(i, { end: e.target.value === '00:00' ? '24:00' : e.target.value })} aria-label="End" />
        <input class="tpl-title" value=${b.title} onChange=${(e) => setB(i, { title: e.target.value })} aria-label="Title" />
        <select value=${b.cat} onChange=${(e) => setB(i, { cat: e.target.value })} aria-label="Category">${CAT_ORDER.map((c) => html`<option value=${c}>${CATS[c].short}</option>`)}</select>
        <select value=${b.sessionId || ''} onChange=${(e) => {
          const ses = sessions.find((x) => x.id === e.target.value);
          setB(i, ses ? { sessionId: ses.id, title: ses.title, cat: ses.cat, location: ses.location || '', remind: ses.remind ?? 30 } : { sessionId: null });
        }} aria-label="Session">
          <option value="">No session</option>${sessions.map((s) => html`<option value=${s.id}>${s.title}</option>`)}
        </select>
        <select value=${b.remind == null ? '' : String(b.remind)} onChange=${(e) => setB(i, { remind: e.target.value === '' ? null : +e.target.value })} aria-label="Reminder">
          <option value="">No reminder</option>${[0, 5, 10, 15, 20, 25, 30, 45, 60].map((m) => html`<option value=${String(m)}>${m ? `${m} min before` : 'At start'}</option>`)}
        </select>
        <button class="icon-btn sm" onClick=${() => setBlocks(blocks.filter((_, j) => j !== i))} aria-label="Remove"><${Icon} name="x" size=${14} /></button>
      </div>`)}
    </div>
    <div class="row-gap wrap">
      <${Btn} kind="quiet" icon="plus" onClick=${() => {
        const last = blocks[blocks.length - 1];
        const s = last ? Math.min(toMin(last.end), 1380) : 16 * 60;
        setBlocks([...blocks, { start: fromMin(s), end: fromMin(Math.min(1440, s + 60)), title: 'New block', cat: 'life', remind: null }]);
      }}>Add block</${Btn}>
      <span class="muted small">Copy ${dayLabel(d)} to:</span>
      ${WD.filter((i) => DOW[i] !== d).map((i) => html`<button class="chip" onClick=${() => copyTo([DOW[i]])}>${DOW_LABEL[i]}</button>`)}
    </div>
  </div>`;
}

function LifePresets({ store }) {
  const settings = M.getSettings(store);
  const list = settings.lifePresets || [];
  const save = (lifePresets) => M.saveSettings(store, { lifePresets });
  const setP = (i, patch) => save(list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return html`<div>
    <p class="lede">One-tap blocks for everything around training. Keywords let quick add recognise them (type “study 3-5”).</p>
    <div class="tpl-rows">
      ${list.map((p, i) => html`<div class=${`tpl-row preset-row cat-${p.cat}`}>
        <i class="dot"></i>
        <input class="tpl-title" value=${p.title} onChange=${(e) => setP(i, { title: e.target.value })} aria-label="Name" />
        <select value=${p.cat} onChange=${(e) => setP(i, { cat: e.target.value })} aria-label="Category">${CAT_ORDER.map((c) => html`<option value=${c}>${CATS[c].short}</option>`)}</select>
        <label class="inline small"><input type="number" min="5" step="5" value=${p.dur} onChange=${(e) => setP(i, { dur: +e.target.value || 30 })} aria-label="Minutes" /> min</label>
        <input value=${(p.keywords || []).join(', ')} onChange=${(e) => setP(i, { keywords: e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) })} placeholder="keywords" aria-label="Keywords" />
        <button class="icon-btn sm" onClick=${() => save(list.filter((_, j) => j !== i))} aria-label="Remove"><${Icon} name="x" size=${14} /></button>
      </div>`)}
    </div>
    <${Btn} kind="quiet" icon="plus" onClick=${() => save([...list, { id: uid('p'), title: 'New preset', cat: 'life', dur: 30, keywords: [] }])}>Add preset</${Btn}>
  </div>`;
}

function ProgramEditor({ store }) {
  const program = M.getProgram(store);
  const [p, setP] = useState(() => program ? { ...program, deloadText: (program.deload || []).join(', ') } : null);
  if (!p) return html`<${Empty} title="No training block">Claude can set one up for you at your next check-in.</${Empty}>`;
  const save = () => {
    const weeks = Math.max(1, +p.weeks || 4);
    const { deloadText, id, ...rest } = p;
    const next = { ...rest, weeks, deload: deloadText.split(',').map((x) => +x.trim()).filter((x) => x >= 1 && x <= weeks), end: addDays(p.start, weeks * 7 - 1) };
    store.put('programs', id, next);
    toast('Training block saved');
  };
  return html`<div class="narrow">
    <p class="lede">Week numbers decide which prescription every session shows. ${program.notes || ''}</p>
    <div class="form-grid">
      <${Field} label="Name" class="span-2"><input value=${p.name} onInput=${(e) => setP({ ...p, name: e.target.value })} /></${Field}>
      <${Field} label="Week 1 starts"><input type="date" value=${p.start} onInput=${(e) => setP({ ...p, start: e.target.value })} /></${Field}>
      <${Field} label="Weeks"><input type="number" min="1" max="16" value=${p.weeks} onInput=${(e) => setP({ ...p, weeks: e.target.value })} /></${Field}>
      <${Field} label="Deload weeks" hint="Comma separated, e.g. 4"><input value=${p.deloadText} onInput=${(e) => setP({ ...p, deloadText: e.target.value })} /></${Field}>
      <${Field} label="Ends"><input disabled value=${p.start ? addDays(p.start, (+p.weeks || 4) * 7 - 1) : ''} /></${Field}>
    </div>
    <div class="row-end"><${Btn} kind="primary" onClick=${save}>Save</${Btn}></div>
  </div>`;
}
