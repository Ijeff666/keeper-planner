import { html, render, useState, useEffect, useMemo } from './lib.js';
import { getSupabase, Store, ls } from './store.js';
import { starterDocs, SESSIONS, BASE_WEEK } from './seed.js';
import { todayKey, nowMin, snap, fromMin, uid, isValidKey, downloadJSON, downloadFile } from './util.js';
import { Icon, Btn, Sheet, Field, Segmented, Toasts, RestTimer, toast } from './ui.js';
import { CalendarView, BlockEditor, DaySheet, FillSheet } from './calendar.js';
import { BlockSheet, WorkoutView, LogQueueSheet } from './workout.js';
import { GymView } from './gym.js';
import { THEMES, ACCENTS, applyTheme, watchSystem } from './theme.js';
import { TodayView, ProgressView, CoachView } from './views.js';
import { LibraryView } from './library.js';
import * as M from './model.js';
import { APP_VERSION } from './config.js';

const TABS = [['today', 'Today', 'today'], ['calendar', 'Calendar', 'calendar'], ['gym', 'Gym', 'dumbbell'], ['progress', 'Progress', 'chart'], ['coach', 'Coach', 'coach'], ['library', 'Library', 'library']];
const FINISHED = { done: 'Workout saved', partial: 'Saved as half done', skipped: 'Marked as skipped' };
const STATUS_LABEL = { loading: 'Loading…', synced: 'Saved', syncing: 'Saving…', offline: 'Offline · saved on this device', local: 'Local mode', error: 'Sync problem' };

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker', e));

function useWide() {
  const q = '(min-width: 900px)';
  const [w, setW] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return w;
}

function readHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = h.match(/^day\/(\d{4}-\d{2}-\d{2})$/);
  if (m && isValidKey(m[1])) return { tab: 'calendar', date: m[1], view: 'day' };
  if (TABS.some(([t]) => t === h)) return { tab: h };
  return { tab: 'today' };
}

function App() {
  const [sb, setSb] = useState(undefined);
  const [session, setSession] = useState(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getSupabase().then(async (c) => {
      setSb(c);
      if (!c) { setSession(null); return; }
      const { data } = await c.auth.getSession();
      setSession(data.session);
      c.auth.onAuthStateChange((_e, s) => setSession(s));
    }).catch((e) => { console.error(e); setFailed(true); });
  }, []);

  if (failed) return html`<div class="boot"><p>Can’t reach the server. Check your connection.</p><${Btn} kind="primary" onClick=${() => location.reload()}>Try again</${Btn}></div>`;
  if (sb === undefined || session === undefined) return html`<div class="boot">Loading Keeper Planner…</div>`;
  if (sb && !session) return html`<${Login} sb=${sb} />`;
  return html`<${Main} sb=${sb} session=${session} key=${session?.user?.id || 'local'} />`;
}

function Login({ sb }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState('in');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const redirect = location.origin + location.pathname;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      if (mode === 'link') {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        setMsg('Check your email for a sign-in link. Open it on this device.');
      } else if (mode === 'up') {
        const { data, error } = await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (!data.session) setMsg('Account created. Confirm it from the email we sent, then sign in.');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      }
    } catch (err) { setMsg(err.message || 'That didn’t work. Try again.'); }
    setBusy(false);
  };
  return html`<main class="login">
    <div class="login-card">
      <p class="login-brand"><img src="icons/icon.svg" alt="" width="28" height="28" />Keeper Planner</p>
      <h1>${mode === 'up' ? 'Create your account' : 'Sign in'}</h1>
      <${Segmented} label="Sign-in method" value=${mode} onChange=${(m) => { setMode(m); setMsg(''); }} options=${[['in', 'Password'], ['link', 'Email link'], ['up', 'New account']]} />
      <form onSubmit=${submit} class="login-form">
        <${Field} label="Email"><input id="login-email" type="email" autocomplete="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} /></${Field}>
        ${mode !== 'link' && html`<${Field} label="Password"><input id="login-password" type="password" autocomplete=${mode === 'up' ? 'new-password' : 'current-password'} required minlength="8" value=${pw} onInput=${(e) => setPw(e.target.value)} /></${Field}>`}
        <${Btn} kind="primary" type="submit" disabled=${busy}>${busy ? 'Working…' : mode === 'link' ? 'Email me a link' : mode === 'up' ? 'Create account' : 'Sign in'}</${Btn}>
      </form>
      ${msg && html`<p class="login-msg" role="status">${msg}</p>`}
    </div>
  </main>`;
}

function Main({ sb, session }) {
  const wide = useWide();
  const store = useMemo(() => new Store(sb, session?.user?.id), [sb, session?.user?.id]);
  const [, setV] = useState(0);
  const init = readHash();
  const [tab, setTabState] = useState(init.tab);
  const [calDate, setCalDate] = useState(init.date || todayKey());
  const [calView, setCalViewState] = useState(init.view || ls.get('kp:calView') || (matchMedia('(min-width: 900px)').matches ? 'week' : 'day'));
  const [sheet, setSheet] = useState(null);
  // The workout in progress survives tab switches and reloads, so leaving the Gym tab never loses a session.
  const [active, setActiveState] = useState(() => ls.get('kp:active'));
  const setActive = (v) => { setActiveState(v); if (v) ls.set('kp:active', v); else ls.del('kp:active'); };

  useEffect(() => {
    const un = store.subscribe(setV);
    store.onError = (m) => toast(`Not saved: ${m}`);
    store.load().then(() => {
      // Seed only when the server (or local mode) really has nothing, never from an offline miss.
      const ok = store.status === 'synced' || store.status === 'syncing' || store.status === 'local';
      if (ok && store.isEmpty()) { store.putMany(starterDocs()); toast('Loaded your starter plan'); }
      // FitTracker v1 data is only readable here if this app is served from v1's old address.
      const v1 = M.readFitTrackerLocal();
      if (ok && v1 && !ls.get('kp:ftImported')) {
        toast(`Found ${v1.workouts.length} FitTracker workouts on this device`, { ms: 12000, action: 'Import', onAction: () => {
          const n = M.importFitTracker(store, v1);
          ls.set('kp:ftImported', new Date().toISOString());
          toast(`Imported ${n.workouts} workouts, ${n.weights} weigh-ins, ${n.notes} notes`);
        } });
      }
    });
    store.listen();
    const online = () => { store.flush(); if (Date.now() - store.lastLoad > 30000) store.load(); };
    const vis = () => { if (document.visibilityState === 'visible') { store.flush(); if (Date.now() - store.lastLoad > 60000) store.load(); } };
    const hash = () => { const h = readHash(); setTabState(h.tab); if (h.date) { setCalDate(h.date); setCalViewState('day'); } };
    window.addEventListener('online', online);
    window.addEventListener('offline', () => store.setStatus('offline'));
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('hashchange', hash);
    navigator.serviceWorker?.addEventListener?.('message', (e) => { if (e.data?.type === 'open' && e.data.url) { location.hash = e.data.url.split('#')[1] || 'today'; } });
    return () => { un(); store.stop(); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', vis); window.removeEventListener('hashchange', hash); };
  }, [store]);

  const settings = M.getSettings(store);
  useEffect(() => {
    const apply = () => applyTheme(settings.theme, settings.accent);
    apply();
    return settings.theme === 'system' ? watchSystem(apply) : undefined;
  }, [settings.theme, settings.accent]);

  const setTab = (t) => { setTabState(t); history.replaceState(null, '', `#${t}`); window.scrollTo(0, 0); };
  const setCalView = (v) => { setCalViewState(v); ls.set('kp:calView', v); };

  const actions = {
    go: setTab,
    openBlock: (date, id) => setSheet({ type: 'block', date, id }),
    editBlock: (date, id) => {
      const b = M.getDay(store, date).blocks.find((x) => x.id === id);
      if (b) setSheet({ type: 'edit', date, block: b, isNew: false });
    },
    openNew: (date, start, end, preset) => {
      const s = start ?? (date === todayKey() ? Math.min(23 * 60, snap(nowMin() + 30, 60)) : 16 * 60);
      const e = end ?? Math.min(1440, s + 60);
      setSheet({ type: 'edit', isNew: true, date, preset, block: { id: uid(), title: '', cat: 'life', start: fromMin(s), end: fromMin(e), remind: null } });
    },
    openDay: (date) => setSheet({ type: 'day', date }),
    openFill: (from) => setSheet({ type: 'fill', from }),
    openWorkout: (date, id) => { setSheet(null); setActive({ date, id, open: true }); setTab('gym'); },
    resumeWorkout: () => { if (active) { setActive({ ...active, open: true }); setTab('gym'); } },
    openQueue: () => setSheet({ type: 'queue' }),
    openSettings: () => setSheet({ type: 'settings' }),
  };
  const close = () => setSheet(null);

  useEffect(() => {
    if (store.loaded && active && store.status !== 'loading' && !M.getDay(store, active.date).blocks.some((b) => b.id === active.id)) setActive(null);
  }, [store.version]);

  if (!store.loaded) return html`<div class="boot">Loading your plan…</div>`;

  const view = {
    today: html`<${TodayView} store=${store} actions=${actions} />`,
    gym: active?.open
      ? html`<${WorkoutView} key=${active.id} store=${store} date=${active.date} blockId=${active.id}
          onBack=${() => setActive({ ...active, open: false })}
          onDone=${(status) => { setActive(null); if (status) toast(FINISHED[status]); }} />`
      : html`<${GymView} store=${store} actions=${actions} active=${active} />`,
    calendar: html`<${CalendarView} store=${store} date=${calDate} setDate=${setCalDate} view=${calView} setView=${setCalView} actions=${actions} wide=${wide} />`,
    progress: html`<${ProgressView} store=${store} actions=${actions} />`,
    coach: html`<${CoachView} store=${store} />`,
    library: html`<${LibraryView} store=${store} actions=${actions} />`,
  }[tab];

  const sync = html`<span class=${`sync sync-${store.status}`} title=${STATUS_LABEL[store.status]}><i></i><span>${STATUS_LABEL[store.status]}</span></span>`;
  const activeBlock = active && M.getDay(store, active.date).blocks.find((b) => b.id === active.id);

  return html`<div class=${`shell ${wide ? 'is-wide' : 'is-narrow'} tab-${tab} ${activeBlock && tab !== 'gym' ? 'has-resume' : ''}`}>
    ${wide ? html`<nav class="rail" aria-label="Main">
        <div class="brand"><img src="icons/icon.svg" alt="" width="32" height="32" /><span>Keeper<br />Planner</span></div>
        ${TABS.map(([t, l, i]) => html`<button class=${tab === t ? 'on' : ''} onClick=${() => setTab(t)} aria-current=${tab === t ? 'page' : null}><${Icon} name=${i} /><span>${l}</span></button>`)}
        <span class="grow"></span>
        ${sync}
        <button onClick=${actions.openSettings}><${Icon} name="gear" /><span>Settings</span></button>
      </nav>`
      : html`<header class="topbar">
        <span class="brand"><img src="icons/icon.svg" alt="" width="26" height="26" /><span>Keeper Planner</span></span>
        ${sync}
        <button class="icon-btn" onClick=${actions.openSettings} aria-label="Settings"><${Icon} name="gear" /></button>
      </header>`}
    <main class="main">${view}</main>
    ${activeBlock && tab !== 'gym' && html`<button type="button" class="resume-bar" onClick=${actions.resumeWorkout}>
      <span class="resume-dot" aria-hidden="true"></span><span class="grow"><b>${activeBlock.title}</b> in progress</span><span class="resume-go">Resume</span>
    </button>`}
    ${!wide && html`<nav class="tabbar" aria-label="Main">
      ${TABS.map(([t, l, i]) => html`<button class=${tab === t ? 'on' : ''} onClick=${() => setTab(t)} aria-current=${tab === t ? 'page' : null}><${Icon} name=${i} /><span>${l}</span></button>`)}
    </nav>`}
    ${!wide && tab === 'calendar' && html`<button class="fab" onClick=${() => actions.openNew(calDate)} aria-label="New block"><${Icon} name="plus" size=${26} /></button>`}

    ${sheet?.type === 'block' && html`<${BlockSheet} key=${sheet.id} store=${store} date=${sheet.date} blockId=${sheet.id} onClose=${close} actions=${actions} />`}
    ${sheet?.type === 'edit' && html`<${BlockEditor} key=${sheet.block.id} store=${store} state=${sheet} onClose=${close} />`}
    ${sheet?.type === 'day' && html`<${DaySheet} key=${sheet.date} store=${store} date=${sheet.date} onClose=${close} actions=${actions} onGo=${(k) => { close(); setCalDate(k); setCalView('day'); setTab('calendar'); }} />`}
    ${sheet?.type === 'queue' && html`<${LogQueueSheet} store=${store} onClose=${close} actions=${actions} today=${todayKey()} nowM=${nowMin()} />`}
    ${sheet?.type === 'fill' && html`<${FillSheet} store=${store} from=${sheet.from} onClose=${close} />`}
    ${sheet?.type === 'settings' && html`<${SettingsSheet} store=${store} sb=${sb} session=${session} onClose=${close} />`}
    <${RestTimer} />
    <${Toasts} />
  </div>`;
}

const b64ToU8 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const sameKey = (buf, u8) => { if (!buf) return false; const a = new Uint8Array(buf); return a.length === u8.length && a.every((v, i) => v === u8[i]); };

async function enablePush(sb, userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser can’t receive push notifications. On a phone, use Chrome.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in Chrome’s site settings, then try again.');
  const reg = await navigator.serviceWorker.ready;
  const { data, error } = await sb.functions.invoke('send-push', { body: { action: 'config' } });
  if (error || !data?.vapidPublic) throw new Error('The notification server isn’t set up yet.');
  const key = b64ToU8(data.vapidPublic);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const j = sub.toJSON();
  const { error: e2 } = await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: userId, keys: j.keys, ua: navigator.userAgent.slice(0, 180) }, { onConflict: 'endpoint' });
  if (e2) throw e2;
}

function SettingsSheet({ store, sb, session, onClose }) {
  const s = M.getSettings(store);
  const set = (patch) => M.saveSettings(store, patch);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [busy, setBusy] = useState(false);
  const [canInstall, setCanInstall] = useState(!!installPrompt);

  const turnOn = async () => {
    setBusy(true);
    try { await enablePush(sb, session.user.id); setPerm('granted'); toast('Reminders are on for this device'); }
    catch (e) { toast(e.message || 'Couldn’t turn on notifications'); setPerm(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'); }
    setBusy(false);
  };
  const test = async () => {
    const { error } = await sb.from('notifications').insert({ user_id: session.user.id, kind: 'message', title: 'Keeper Planner test', body: 'Reminders reach this device.', url: './#today' });
    toast(error ? `Couldn’t send: ${error.message}` : 'Sent. It should arrive within a minute.');
  };
  const exportAll = () => downloadJSON(`keeper-planner-${todayKey()}.json`, { exportedAt: new Date().toISOString(), version: APP_VERSION, docs: store.docs });
  const importAll = async (file) => {
    try {
      const j = JSON.parse(await file.text());
      const rows = [];
      for (const [coll, items] of Object.entries(j.docs || {})) for (const [id, data] of Object.entries(items)) rows.push([coll, id, data]);
      if (!rows.length) throw new Error('No data in that file.');
      store.putMany(rows);
      toast(`Imported ${rows.length} records`);
    } catch (e) { toast(e.message || 'That file couldn’t be read'); }
  };
  const restoreStarter = () => {
    store.putMany([...SESSIONS.map((x) => ['sessions', x.id, x]), ['templates', BASE_WEEK.id, BASE_WEEK]]);
    toast('Starter sessions and base week restored');
  };
  const v1 = M.readFitTrackerLocal();
  const runImport = (data) => {
    const n = M.importFitTracker(store, data);
    ls.set('kp:ftImported', new Date().toISOString());
    toast(n.workouts + n.weights + n.notes + n.plans ? `Imported ${n.workouts} workouts (${n.sets} sets), ${n.weights} weigh-ins, ${n.notes} notes, ${n.plans} plans` : 'Nothing new to import');
  };
  const importCSV = async (file) => {
    try { runImport(M.fitTrackerFromCSV(await file.text())); } catch (e) { toast(e.message || 'That file couldn’t be read'); }
  };

  return html`<${Sheet} open modal title="Settings" onClose=${onClose}>
    <h3 class="sub">Look</h3>
    <div class="themes" role="radiogroup" aria-label="Theme">
      ${THEMES.map((t) => html`<button type="button" role="radio" aria-checked=${(s.theme || 'industrial') === t.id}
          class=${`theme-opt ${(s.theme || 'industrial') === t.id ? 'on' : ''}`} onClick=${() => set({ theme: t.id })}>
        <span class="theme-sw">${t.sw.map((c) => html`<i style=${`background:${c}`}></i>`)}</span>
        <span class="theme-name">${t.name}</span>
        <span class="theme-desc">${t.desc}</span>
      </button>`)}
    </div>
    <${Field} label="Accent">
      <div class="accents" role="radiogroup" aria-label="Accent color">
        ${ACCENTS.map((a) => html`<button type="button" role="radio" aria-checked=${(s.accent || 'theme') === a.id} title=${a.name}
            class=${`accent-opt ${(s.accent || 'theme') === a.id ? 'on' : ''}`} onClick=${() => set({ accent: a.id })}>
          <i style=${a.dark ? `background:${a.dark}` : ''}></i><span>${a.name}</span>
        </button>`)}
      </div>
    </${Field}>

    <h3 class="sub">Reminders</h3>
    <h3 class="sub">Reminders</h3>
    ${sb ? html`<div class="settings-row">
        <p>${perm === 'granted' ? 'Notifications are allowed on this device.' : perm === 'denied' ? 'Notifications are blocked for this site. Allow them in Chrome’s site settings.' : 'Get a reminder before each training block, plus messages from Claude.'}</p>
        <div class="row-gap wrap">
          <${Btn} kind=${perm === 'granted' ? 'quiet' : 'primary'} icon="bell" onClick=${turnOn} disabled=${busy || perm === 'unsupported'}>${perm === 'granted' ? 'Re-register this device' : 'Turn on reminders'}</${Btn}>
          ${perm === 'granted' && html`<${Btn} kind="quiet" onClick=${test}>Send a test</${Btn}>`}
        </div>
      </div>`
      : html`<p class="muted">Reminders work once the app is connected to its server.</p>`}
    <${Field} label="Default reminder for new training blocks">
      <select value=${String(s.remindDefault ?? 30)} onChange=${(e) => set({ remindDefault: +e.target.value })}>
        ${[0, 10, 15, 20, 30, 45, 60].map((m) => html`<option value=${String(m)}>${m ? `${m} min before` : 'At start'}</option>`)}
      </select>
    </${Field}>

    <h3 class="sub">Calendar and tracking</h3>
    <div class="form-grid">
      <${Field} label="Week starts"><${Segmented} label="Week starts" value=${s.weekStart ?? 1} onChange=${(v) => set({ weekStart: v })} options=${[[1, 'Monday'], [0, 'Sunday']]} /></${Field}>
      <${Field} label="Daily water goal">
        <select value=${String(s.waterGoal || 8)} onChange=${(e) => set({ waterGoal: +e.target.value })}>${[6, 8, 10, 12, 14].map((n) => html`<option value=${String(n)}>${n} cups</option>`)}</select>
      </${Field}>
      <${Field} label="Day starts at">
        <select value=${String(s.gridStart ?? 6)} onChange=${(e) => set({ gridStart: +e.target.value })}>${[0, 4, 5, 6, 7, 8].map((h) => html`<option value=${String(h)}>${h === 0 ? 'Midnight' : `${h}am`}</option>`)}</select>
      </${Field}>
      <${Field} label="Weights in">
        <${Segmented} label="Units" value=${s.units || 'lb'} onChange=${(v) => set({ units: v })} options=${[['lb', 'lb'], ['kg', 'kg']]} />
      </${Field}>
    </div>

    <h3 class="sub">App</h3>
    <div class="row-gap wrap">
      ${canInstall && html`<${Btn} kind="primary" onClick=${async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; setCanInstall(false); }}>Install on this device</${Btn}>`}
      <${Btn} kind="quiet" icon="download" onClick=${exportAll}>Back up everything (JSON)</${Btn}>
      <${Btn} kind="quiet" icon="download" onClick=${() => downloadFile(`keeper-sets-${todayKey()}.csv`, M.setsCSV(store), 'text/csv')}>Export sets (CSV)</${Btn}>
      <label class="btn btn-quiet file-btn"><span>Restore a backup</span><input type="file" accept="application/json" onChange=${(e) => e.target.files[0] && importAll(e.target.files[0])} /></label>
      <${Btn} kind="quiet" onClick=${restoreStarter}>Restore starter sessions</${Btn}>
    </div>
    ${!canInstall && html`<p class="muted small">To install on Android: Chrome menu ⋮, then Add to Home screen.</p>`}

    <h3 class="sub">FitTracker v1</h3>
    <p class="muted small">Bring over workouts, weigh-ins, notes and plans from the old app. Running it twice won’t double anything.</p>
    <div class="row-gap wrap">
      ${v1 && html`<${Btn} kind="primary" onClick=${() => runImport(v1)}>Import ${v1.workouts.length} workouts found on this device</${Btn}>`}
      <label class="btn btn-quiet file-btn"><span>Import workouts.csv</span><input type="file" accept=".csv,text/csv" onChange=${(e) => e.target.files[0] && importCSV(e.target.files[0])} /></label>
    </div>

    <h3 class="sub">Account</h3>
    ${sb ? html`<div class="settings-row"><p>${session.user.email}</p><${Btn} kind="quiet" onClick=${() => sb.auth.signOut()}>Sign out</${Btn}></div>`
      : html`<p class="muted">Local mode: your data stays in this browser.</p>`}
    <p class="muted small">Version ${APP_VERSION} · ${STATUS_LABEL[store.status]}</p>
  </${Sheet}>`;
}

render(html`<${App} />`, document.getElementById('app'));
