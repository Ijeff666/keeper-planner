// Look options. Saved in settings, and mirrored to localStorage so index.html can paint the right theme before data loads.

export const THEMES = [
  { id: 'industrial', name: 'Industrial', desc: 'Black and steel, sharp edges', sw: ['#0B0B0C', '#1B1B1E', '#FF6A1A'] },
  { id: 'whiteboard', name: 'Whiteboard', desc: 'Light, marker colors', sw: ['#F3F5F1', '#FFFFFF', '#E4572E'] },
  { id: 'blackboard', name: 'Blackboard', desc: 'Dark slate, chalk text', sw: ['#0E1411', '#1F2924', '#FF6B3D'] },
  { id: 'pitch', name: 'Pitch', desc: 'Deep turf green, white lines', sw: ['#0C1A12', '#183021', '#F4F7F2'] },
  { id: 'system', name: 'Auto', desc: 'Whiteboard by day, Blackboard at night', sw: ['#F3F5F1', '#0E1411', '#E4572E'] },
];
const DARK = new Set(['industrial', 'blackboard', 'pitch']);

// FitTracker v1's accent colors, each tuned for light and dark grounds.
export const ACCENTS = [
  { id: 'theme', name: 'Theme default' },
  { id: 'orange', name: 'Safety orange', light: '#C94A0C', dark: '#FF6A1A' },
  { id: 'red', name: 'Signal red', light: '#C8102E', dark: '#FF4D5E' },
  { id: 'yellow', name: 'Hazard yellow', light: '#8A6200', dark: '#FFC21A' },
  { id: 'green', name: 'Turf green', light: '#1E7B34', dark: '#3DDC6A' },
  { id: 'blue', name: 'Kit blue', light: '#1F5BD6', dark: '#7AA2FF' },
  { id: 'steel', name: 'Steel', light: '#3D4A57', dark: '#C9D1D9' },
];

const darkMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const resolveTheme = (t) => {
  if (t === 'light') return 'whiteboard';
  if (t === 'dark') return 'blackboard';
  if (!t || t === 'system') return darkMQ?.matches ? 'blackboard' : 'whiteboard';
  return THEMES.some((x) => x.id === t) ? t : 'industrial';
};

export function applyTheme(theme = 'industrial', accent = 'theme') {
  const t = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = t;
  const a = ACCENTS.find((x) => x.id === accent);
  if (a?.light) {
    root.style.setProperty('--accent', DARK.has(t) ? a.dark : a.light);
    root.style.setProperty('--accent-ink', DARK.has(t) ? '#0B0B0C' : '#FFFFFF');
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-ink');
  }
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = bg; m.removeAttribute('media'); });
  try { localStorage.setItem('kp:look', JSON.stringify({ theme, accent })); } catch { /* storage blocked */ }
}

export function watchSystem(fn) {
  darkMQ?.addEventListener?.('change', fn);
  return () => darkMQ?.removeEventListener?.('change', fn);
}
