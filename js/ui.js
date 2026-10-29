import { html, useEffect, useRef, useState } from './lib.js';
import { CATS, CAT_ORDER } from './util.js';

const P = {
  today: 'M12 3v2M12 19v2M3 12h2M19 12h2M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z',
  calendar: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  coach: 'M4 5h16v11H9l-5 4z',
  library: 'M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1l-3.9 14.5l-3.8-1z',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3a1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  left: 'M15 18l-6-6l6-6',
  right: 'M9 18l6-6l-6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  play: 'M8 5l11 7l-11 7z',
  timer: 'M12 8v5l3 2M9 2h6M12 4a9 9 0 1 0 0 18a9 9 0 0 0 0-18z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  note: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  repeat: 'M17 2l4 4l-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4l4-4M21 13v2a3 3 0 0 1-3 3H3',
  pin: 'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5z',
  bolt: 'M13 2L4 14h7l-1 8l9-12h-7z',
  send: 'M4 12l16-8l-6 16l-3-7z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8a6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 18z',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  download: 'M12 4v11M7 10l5 5l5-5M5 20h14',
  dumbbell: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12',
  up: 'M6 15l6-6l6 6',
  down: 'M6 9l6 6l6-6',
};

export function Icon({ name, size = 20, class: cls = '' }) {
  return html`<svg class=${`icon ${cls}`} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[name] || ''} /></svg>`;
}

export function Btn({ kind = 'plain', icon, children, class: cls = '', ...rest }) {
  return html`<button type="button" class=${`btn btn-${kind} ${cls}`} ...${rest}>
    ${icon && html`<${Icon} name=${icon} size=${18} />`}${children && html`<span>${children}</span>`}
  </button>`;
}

// On big screens sheets dock to the right as a side panel, so the calendar stays usable next to them.
const dockMQ = typeof matchMedia === 'function' ? matchMedia('(min-width: 1200px)') : null;
export function useDocked() {
  const [d, setD] = useState(!!dockMQ?.matches);
  useEffect(() => {
    const f = () => setD(dockMQ.matches);
    dockMQ?.addEventListener?.('change', f);
    return () => dockMQ?.removeEventListener?.('change', f);
  }, []);
  return d;
}

export function Sheet({ open, title, onClose, children, footer, wide, full, modal, class: cls = '' }) {
  const ref = useRef();
  const docked = useDocked() && !modal;
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    setTimeout(() => ref.current?.querySelector('[data-autofocus]')?.focus(), 30);
    const bodyCls = docked ? 'dock-open' : 'sheet-open';
    document.body.classList.add(bodyCls);
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove(bodyCls); if (!docked) prev?.focus?.(); };
  }, [open, docked]);
  if (!open) return null;
  const inner = html`<div ref=${ref} class=${`sheet ${wide ? 'sheet-wide' : ''} ${full ? 'sheet-full' : ''} ${cls}`} role="dialog" aria-modal=${docked ? 'false' : 'true'} aria-label=${title}>
    <header class="sheet-head">
      <h2>${title}</h2>
      <button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button>
    </header>
    <div class="sheet-body">${children}</div>
    ${footer && html`<footer class="sheet-foot">${footer}</footer>`}
  </div>`;
  if (docked) return html`<aside class="dock">${inner}</aside>`;
  return html`<div class="sheet-wrap" onClick=${(e) => { if (e.target === e.currentTarget) onClose?.(); }}>${inner}</div>`;
}

export function Field({ label, hint, children, class: cls = '' }) {
  return html`<label class=${`field ${cls}`}><span class="field-label">${label}</span>${children}${hint && html`<span class="field-hint">${hint}</span>`}</label>`;
}

export function CatPicker({ value, onChange, only }) {
  const cats = only || CAT_ORDER;
  return html`<div class="cat-picker" role="radiogroup" aria-label="Category">
    ${cats.map((c) => html`<button type="button" role="radio" aria-checked=${value === c}
      class=${`cat-pill cat-${c} ${value === c ? 'on' : ''}`} onClick=${() => onChange(c)}>${CATS[c].short}</button>`)}
  </div>`;
}

export function Segmented({ options, value, onChange, label }) {
  return html`<div class="seg" role="radiogroup" aria-label=${label}>
    ${options.map(([v, l]) => html`<button type="button" role="radio" aria-checked=${value === v} class=${value === v ? 'on' : ''} onClick=${() => onChange(v)}>${l}</button>`)}
  </div>`;
}

export function Scale({ value, onChange, max = 5, labels, label }) {
  return html`<div class="scale" role="radiogroup" aria-label=${label}>
    ${Array.from({ length: max }, (_, i) => i + 1).map((n) => html`<button type="button" role="radio" aria-checked=${value === n}
      class=${value === n ? 'on' : ''} title=${labels?.[n - 1] || ''} onClick=${() => onChange(value === n ? null : n)}>${n}</button>`)}
  </div>`;
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, suffix = '', label }) {
  const v = value ?? '';
  const set = (n) => onChange(Math.min(max, Math.max(min, Math.round(n * 100) / 100)));
  return html`<div class="stepper" aria-label=${label}>
    <button type="button" onClick=${() => set((+v || 0) - step)} aria-label="Less">−</button>
    <span class="stepper-val">${v === '' ? '–' : v}${v !== '' && suffix}</span>
    <button type="button" onClick=${() => set((+v || 0) + step)} aria-label="More">+</button>
  </div>`;
}

export function Empty({ title, children, action }) {
  return html`<div class="empty"><p class="empty-title">${title}</p>${children && html`<p class="empty-text">${children}</p>`}${action}</div>`;
}

let pushToast = () => {};
export const toast = (msg, opts = {}) => pushToast(msg, opts);
export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushToast = (msg, { action, onAction, ms = 3200 } = {}) => {
      const id = Math.random();
      setItems((xs) => [...xs, { id, msg, action, onAction }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), ms);
    };
  }, []);
  return html`<div class="toasts" role="status" aria-live="polite">
    ${items.map((t) => html`<div class="toast" key=${t.id}><span>${t.msg}</span>
      ${t.action && html`<button onClick=${() => { t.onAction?.(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>${t.action}</button>`}</div>`)}
  </div>`;
}

let startRest = () => {};
export const restTimer = (secs, label) => startRest(secs, label);
let audioCtx = null;
function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; g.gain.value = 0.15;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.25);
  } catch { /* no audio */ }
}
export function RestTimer() {
  const [t, setT] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => {
    startRest = (secs, label) => {
      try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch { /* ignore */ }
      setT({ end: Date.now() + secs * 1000, secs, label, done: false });
    };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setInterval(() => {
      tick((n) => n + 1);
      if (!t.done && Date.now() >= t.end) {
        navigator.vibrate?.([200, 100, 200]);
        beep();
        setT((x) => x && { ...x, done: true });
      }
    }, 250);
    return () => clearInterval(id);
  }, [t]);
  if (!t) return null;
  const left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
  const pct = 100 - (left / t.secs) * 100;
  return html`<div class=${`rest ${t.done ? 'rest-done' : ''}`} role="timer" aria-live="off">
    <div class="rest-bar" style=${`width:${pct}%`}></div>
    <${Icon} name="timer" size=${18} />
    <span class="rest-time">${t.done ? 'Go' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
    <span class="rest-label">${t.done ? 'Rest is over' : t.label || 'Rest'}</span>
    <button onClick=${() => setT((x) => ({ ...x, end: x.end + 30000, secs: x.secs + 30, done: false }))}>+30s</button>
    <button onClick=${() => setT(null)} aria-label="Dismiss timer"><${Icon} name="x" size=${16} /></button>
  </div>`;
}
