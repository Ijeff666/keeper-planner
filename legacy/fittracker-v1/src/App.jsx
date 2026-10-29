import { useState, useEffect, useMemo } from 'react';
import {
  Dumbbell, BarChart2, Calendar, Home, Plus, Trash2, ChevronLeft,
  Check, TrendingUp, Flame, Award, X, Edit2, Play, Pause, RotateCcw,
  ArrowUp, Scale, ChevronDown, ChevronUp, Zap, Activity, FileText,
  Droplets, RefreshCw, Quote, Download, Shuffle, Trophy, Palette,
  AlarmClock, ArrowRight
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Storage (localStorage for Vercel) ───────────────────────────────────────
const KEYS = { workouts:'ft_workouts', bodyweight:'ft_bodyweight', plans:'ft_plans', schedule:'ft_schedule', notes:'ft_notes', water:'ft_water', theme:'ft_theme' };
const lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── Themes ───────────────────────────────────────────────────────────────────
const THEMES = {
  industrial:  { name:'Industrial',  emoji:'🔩', desc:'Steel & rust. Built for work.',  accent:'#f97316', am:'rgba(249,115,22,0.15)', bg:'#0c0a08', card:'#161210', border:'#2a1f15', nav:'#0c0a08', text:'#e8d5c0', sub:'#8a7060',  inp:'#1e1510' },
  matrix:      { name:'Matrix',      emoji:'💻', desc:'You take the green pill.',       accent:'#00ff41', am:'rgba(0,255,65,0.1)',    bg:'#000300', card:'#020a02', border:'#003300', nav:'#000300', text:'#00cc33', sub:'#006614',  inp:'#010701' },
  blood:       { name:'Blood Sport', emoji:'🩸', desc:'No days off.',                   accent:'#dc2626', am:'rgba(220,38,38,0.15)',  bg:'#080000', card:'#130000', border:'#2d0000', nav:'#080000', text:'#f5c0c0', sub:'#7a3535',  inp:'#1a0000' },
  arctic:      { name:'Arctic',      emoji:'🧊', desc:'Ice cold focus.',                accent:'#67e8f9', am:'rgba(103,232,249,0.12)',bg:'#020b10', card:'#061420', border:'#0c2a3a', nav:'#020b10', text:'#cce8f4', sub:'#3a6a80',  inp:'#071825' },
  midnight:    { name:'Midnight',    emoji:'🌙', desc:'Dark and focused.',              accent:'#818cf8', am:'rgba(129,140,248,0.15)',bg:'#0a0a1a', card:'#111128', border:'#1e1e45', nav:'#0a0a1a', text:'#c7c9f0', sub:'#4a4a80',  inp:'#0d0d22' },
  gold:        { name:'Gold Chain',  emoji:'⛓️',  desc:'Heavy is the head.',             accent:'#eab308', am:'rgba(234,179,8,0.15)',  bg:'#080600', card:'#120e00', border:'#2a2000', nav:'#080600', text:'#f5e6a0', sub:'#7a6a20',  inp:'#181200' },
  ghost:       { name:'Ghost',       emoji:'👻', desc:'Clean. Minimal. Silent.',        accent:'#e2e8f0', am:'rgba(226,232,240,0.1)', bg:'#080808', card:'#111111', border:'#222222', nav:'#080808', text:'#e2e8f0', sub:'#555555',  inp:'#161616' },
  ultraviolet: { name:'Ultraviolet', emoji:'⚡', desc:'High voltage.',                  accent:'#a855f7', am:'rgba(168,85,247,0.15)', bg:'#06000f', card:'#0f0018', border:'#2a0045', nav:'#06000f', text:'#e0c0ff', sub:'#5a3080',  inp:'#0d0020' },
};
const DEFAULT_THEME = 'industrial';

// ─── Rank system ──────────────────────────────────────────────────────────────
const RANKS = [
  { name:'Unranked', min:0,   color:'#374151', emoji:'—'  },
  { name:'Bronze',   min:10,  color:'#b45309', emoji:'🥉' },
  { name:'Silver',   min:30,  color:'#9ca3af', emoji:'🥈' },
  { name:'Gold',     min:60,  color:'#eab308', emoji:'🥇' },
  { name:'Platinum', min:100, color:'#67e8f9', emoji:'💎' },
  { name:'Diamond',  min:150, color:'#818cf8', emoji:'🔷' },
  { name:'Elite',    min:200, color:'#a855f7', emoji:'👑' },
  { name:'Legend',   min:300, color:'#f97316', emoji:'🔥' },
];
const getRank = (s) => [...RANKS].reverse().find(r => s >= r.min) || RANKS[0];
const getNextRank = (s) => RANKS.find(r => s < r.min) || null;

// ─── Body map regions ─────────────────────────────────────────────────────────
const BODY_FRONT = {
  Chest:     { d:'M 78,65 Q 96,58 114,65 L 114,82 Q 96,88 78,82 Z' },
  Core:      { d:'M 80,84 Q 96,80 112,84 L 112,106 Q 96,110 80,106 Z' },
  Shoulders: { multi:['M 58,55 Q 66,48 76,54 L 76,70 Q 66,72 58,68 Z','M 116,54 Q 126,48 134,55 L 134,68 Q 126,72 116,70 Z'] },
  Biceps:    { multi:['M 48,72 Q 56,70 62,74 L 60,94 Q 52,96 46,90 Z','M 130,74 Q 136,70 144,72 L 146,90 Q 140,96 132,94 Z'] },
  Legs:      { multi:['M 78,112 Q 86,110 94,112 L 94,152 Q 86,156 78,152 Z','M 98,112 Q 106,110 114,112 L 114,152 Q 106,156 98,152 Z'] },
  Cardio:    { d:'M 84,44 Q 96,38 108,44 L 108,56 Q 96,60 84,56 Z' },
  'Full Body':{ d:'M 72,56 Q 96,50 120,56 L 120,110 Q 96,116 72,110 Z' },
};
const BODY_BACK = {
  Back:      { d:'M 78,62 Q 96,56 114,62 L 116,96 Q 96,102 76,96 Z' },
  Glutes:    { multi:['M 78,102 Q 86,100 94,102 L 94,118 Q 86,122 78,118 Z','M 98,102 Q 106,100 114,102 L 114,118 Q 106,122 98,118 Z'] },
  Triceps:   { multi:['M 48,72 Q 56,70 62,74 L 60,94 Q 52,96 46,90 Z','M 130,74 Q 136,70 144,72 L 146,90 Q 140,96 132,94 Z'] },
  Shoulders: { multi:['M 58,55 Q 66,48 76,54 L 76,70 Q 66,72 58,68 Z','M 116,54 Q 126,48 134,55 L 134,68 Q 126,72 116,70 Z'] },
};

// ─── Static data ──────────────────────────────────────────────────────────────
const MUSCLE_GROUPS = ['Chest','Back','Shoulders','Biceps','Triceps','Legs','Glutes','Core','Full Body','Cardio'];
const PLAN_COLORS = ['#f97316','#3b82f6','#22c55e','#a855f7','#ef4444','#eab308','#06b6d4','#ec4899'];
const WATER_GOAL = 8;
const MILESTONES = [1,2,4,8,12,16,24,52];
const getMilestone = (s) => MILESTONES.find(m => m === s);
const ALTS = {
  'Bench Press':['Push-Ups','Dumbbell Press','Cable Fly','Chest Dips'],
  'Squat':['Leg Press','Bulgarian Split Squat','Goblet Squat','Hack Squat'],
  'Deadlift':['Romanian Deadlift','Trap Bar Deadlift','Good Mornings','Back Extensions'],
  'Overhead Press':['Dumbbell Shoulder Press','Arnold Press','Landmine Press','Machine Press'],
  'Barbell Row':['Dumbbell Row','Cable Row','T-Bar Row','Chest-Supported Row'],
  'Pull-Ups':['Lat Pulldown','Assisted Pull-Ups','Cable Pullover','Negative Pull-Ups'],
  'Barbell Curl':['Dumbbell Curl','Hammer Curl','Cable Curl','Preacher Curl'],
  'Tricep Pushdown':['Overhead Tricep Extension','Skull Crushers','Diamond Push-Ups','Cable Kickback'],
};
const QUOTES = [
  {t:'The pain you feel today will be the strength you feel tomorrow.',a:'Arnold Schwarzenegger'},
  {t:'If something stands between you and your success, move it. Never be denied.',a:'Dwayne Johnson'},
  {t:'The last three or four reps is what makes the muscle grow.',a:'Arnold Schwarzenegger'},
  {t:'You have to think it before you can do it.',a:'Kai Greene'},
  {t:'All progress takes place outside the comfort zone.',a:'Michael John Bobak'},
  {t:'No man has the right to be an amateur in physical training.',a:'Socrates'},
  {t:'To keep winning, I have to keep improving.',a:'Ronnie Coleman'},
  {t:'Strength does not come from physical capacity. It comes from an indomitable will.',a:'Mahatma Gandhi'},
  {t:'Take care of your body. It\'s the only place you have to live.',a:'Jim Rohn'},
  {t:'Once the mind says it can\'t be done, the body won\'t do it.',a:'David Goggins'},
  {t:'You don\'t find willpower. You create it.',a:'David Goggins'},
  {t:'Don\'t stop when you\'re tired. Stop when you\'re done.',a:'David Goggins'},
  {t:'We are what we repeatedly do. Excellence is not an act, but a habit.',a:'Aristotle'},
  {t:'If it doesn\'t challenge you, it doesn\'t change you.',a:'Fred DeVito'},
  {t:'The body achieves what the mind believes.',a:'Napoleon Hill'},
  {t:'Champions are made from something deep inside.',a:'Muhammad Ali'},
  {t:'A year from now you\'ll wish you had started today.',a:'Karen Lamb'},
  {t:'Either you run the day, or the day runs you.',a:'Jim Rohn'},
];
const DEFAULT_PLANS = [
  {id:'p1',name:'Push Day',color:'#f97316',exercises:[
    {id:'e1',name:'Bench Press',muscleGroup:'Chest',sets:4,reps:8,weight:135},
    {id:'e2',name:'Incline DB Press',muscleGroup:'Chest',sets:3,reps:10,weight:60},
    {id:'e3',name:'Overhead Press',muscleGroup:'Shoulders',sets:3,reps:10,weight:95},
    {id:'e4',name:'Lateral Raises',muscleGroup:'Shoulders',sets:3,reps:15,weight:20},
    {id:'e5',name:'Tricep Pushdown',muscleGroup:'Triceps',sets:3,reps:12,weight:50},
  ]},
  {id:'p2',name:'Pull Day',color:'#3b82f6',exercises:[
    {id:'e6',name:'Deadlift',muscleGroup:'Back',sets:4,reps:5,weight:225},
    {id:'e7',name:'Barbell Row',muscleGroup:'Back',sets:3,reps:8,weight:135},
    {id:'e8',name:'Pull-Ups',muscleGroup:'Back',sets:3,reps:8,weight:0},
    {id:'e9',name:'Face Pulls',muscleGroup:'Shoulders',sets:3,reps:15,weight:30},
    {id:'e10',name:'Barbell Curl',muscleGroup:'Biceps',sets:3,reps:10,weight:65},
  ]},
  {id:'p3',name:'Leg Day',color:'#22c55e',exercises:[
    {id:'e11',name:'Squat',muscleGroup:'Legs',sets:4,reps:8,weight:185},
    {id:'e12',name:'Romanian Deadlift',muscleGroup:'Legs',sets:3,reps:10,weight:135},
    {id:'e13',name:'Leg Press',muscleGroup:'Legs',sets:3,reps:12,weight:270},
    {id:'e14',name:'Leg Curl',muscleGroup:'Legs',sets:3,reps:12,weight:80},
    {id:'e15',name:'Calf Raises',muscleGroup:'Legs',sets:4,reps:15,weight:100},
  ]},
];
const DEFAULT_SCHEDULE = {0:null,1:'p2',2:'p3',3:'p1',4:null,5:'p2',6:'p3'};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,10);
const todayStr = () => new Date().toISOString().slice(0,10);
const dayName = (d) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d];
const weekStartStr = () => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().slice(0,10); };
const fmt = (n) => n>=1000?`${(n/1000).toFixed(1)}k`:String(Math.round(n));
const fmtTime = (ts) => new Date(ts).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const epley = (w,r) => r===1?w:Math.round(w*(1+r/30));
const daysSince = (ds) => Math.floor((Date.now()-new Date(ds))/(86400000));
const getExHist = (workouts,name) => {
  const r=[];
  const target = name?String(name).toLowerCase():'';
  workouts.forEach(w=>w.exercises?.forEach(e=>{
    const en = e?.name?String(e.name).toLowerCase():'';
    if(en && target && en===target) r.push({...e,date:w.date});
  }));
  return r.sort((a,b)=>b.date.localeCompare(a.date));
};
const getPRs = (workouts) => {
  const b={};
  workouts.forEach(w=>w.exercises?.forEach(e=>{
    if(!e || !e.name) return;
    const key = String(e.name);
    if(!b[key] || e.weight>b[key].weight || (e.weight===b[key].weight && e.reps>b[key].reps)) b[key] = {...e,date:w.date};
  }));
  return Object.values(b).sort((a,b)=>b.date.localeCompare(a.date));
};
const calcWeekVol = (workouts) => {
  const ws=weekStartStr();
  return workouts.filter(w=>w.date>=ws).reduce((a,w)=>a+(w.exercises?.reduce((b,e)=>b+(e.sets*e.reps*e.weight),0)??0),0);
};
const calcStreak = (workouts) => {
  if(!workouts.length)return 0;
  let s=0;const now=new Date();
  for(let i=0;i<52;i++){
    const ws=new Date(now);ws.setDate(ws.getDate()-ws.getDay()-i*7);
    const we=new Date(ws);we.setDate(we.getDate()+6);
    const wss=ws.toISOString().slice(0,10),wes=we.toISOString().slice(0,10);
    if(workouts.some(w=>w.date>=wss&&w.date<=wes))s++;else if(i>0)break;
  }
  return s;
};
const calcWeeklyData = (workouts) => {
  const m={};
  workouts.forEach(w=>{const d=new Date(w.date);d.setDate(d.getDate()-d.getDay());const k=d.toISOString().slice(5,10);m[k]=(m[k]||0)+(w.exercises?.reduce((a,e)=>a+(e.sets*e.reps*e.weight),0)??0);});
  return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8).map(([week,vol])=>({week,vol}));
};
const calc7Days = (workouts) => {
  const days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);const vol=workouts.filter(w=>w.date===ds).reduce((a,w)=>a+(w.exercises?.reduce((b,e)=>b+(e.sets*e.reps*e.weight),0)??0),0);days.push({day:dayName(d.getDay()),vol});}
  return days;
};
const calcMuscleSets = (workouts) => {
  const m={};
  workouts.forEach(w=>w.exercises?.forEach(e=>{m[e.muscleGroup]=(m[e.muscleGroup]||0)+e.sets;}));
  return m;
};

// ─── Style shortcuts ──────────────────────────────────────────────────────────
const C = 'rounded-2xl border'; // card className
const s = {
  card: (T) => ({background:T.card,borderColor:T.border}),
  inp:  (T) => ({background:T.inp,color:T.text,borderColor:T.border}),
  bg:   (T) => ({background:T.bg}),
};

// ─── Rest Timer ───────────────────────────────────────────────────────────────
function RestTimer({onDone,accent}) {
  const [sec,setSec]=useState(90);const[run,setRun]=useState(true);const tot=90;
  useEffect(()=>{if(!run)return;if(sec<=0){onDone();return;}const t=setTimeout(()=>setSec(x=>x-1),1000);return()=>clearTimeout(t);},[sec,run,onDone]);
  const r=44,circ=2*Math.PI*r;
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2937" strokeWidth="8"/>
          <circle cx="50" cy="50" r={r} fill="none" stroke={accent} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={circ*(1-sec/tot)} strokeLinecap="round"
            style={{transition:'stroke-dashoffset 1s linear'}}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-white">{sec}s</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={()=>setRun(r=>!r)} className="p-2 rounded-xl bg-gray-800 text-white">{run?<Pause size={16}/>:<Play size={16}/>}</button>
        <button onClick={()=>setSec(tot)} className="p-2 rounded-xl bg-gray-800 text-white"><RotateCcw size={16}/></button>
        <button onClick={onDone} className="px-3 py-1.5 rounded-xl text-white font-bold text-sm" style={{background:accent}}>Skip</button>
      </div>
    </div>
  );
}

// ─── Body SVG ─────────────────────────────────────────────────────────────────
function BodySVG({muscleData,view,onSelect,selected,accent}) {
  const regions = view==='front'?BODY_FRONT:BODY_BACK;
  const silhouette = (
    <g fill="#1a2030" stroke="#2d3748" strokeWidth="0.5">
      <ellipse cx="96" cy="32" rx="20" ry="22"/>
      <rect x="70" y="52" width="52" height="58" rx="6"/>
      <rect x="42" y="54" width="26" height="58" rx="6"/>
      <rect x="124" y="54" width="26" height="58" rx="6"/>
      <rect x="72" y="108" width="22" height="55" rx="6"/>
      <rect x="98" y="108" width="22" height="55" rx="6"/>
    </g>
  );
  return (
    <svg viewBox="0 0 192 170" className="w-full" style={{maxHeight:180}}>
      {silhouette}
      {Object.entries(regions).map(([mg,region])=>{
        const sets=muscleData[mg]||0;
        const rank=getRank(sets);
        const op=sets>0?0.85:0.1;
        const isSelected=selected===mg;
        const baseStyle={fill:rank.color,fillOpacity:op,stroke:isSelected?'#fff':(sets>0?rank.color:'transparent'),strokeWidth:isSelected?2:0.5,cursor:'pointer',transition:'all 0.2s',filter:sets>0?`drop-shadow(0 0 3px ${rank.color}88)`:'none'};
        const onClick=()=>onSelect(mg===selected?null:mg);
        if(region.multi)return region.multi.map((d,i)=><path key={`${mg}-${i}`} d={d} style={baseStyle} onClick={onClick}/>);
        return <path key={mg} d={region.d} style={baseStyle} onClick={onClick}/>;
      })}
      {selected&&(
        <text x="96" y="168" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
          {selected} · {muscleData[selected]||0} sets
        </text>
      )}
    </svg>
  );
}

// ─── Muscle Heat Map ──────────────────────────────────────────────────────────
function MuscleHeatMap({workouts,T}) {
  const [view,setView]=useState('front');
  const [mode,setMode]=useState('week');
  const [selected,setSelected]=useState(null);
  const ws=weekStartStr();
  const weekData=useMemo(()=>calcMuscleSets(workouts.filter(w=>w.date>=ws)),[workouts]);
  const allData=useMemo(()=>calcMuscleSets(workouts),[workouts]);
  const data=mode==='week'?weekData:allData;
  const selSets=selected?(data[selected]||0):0;
  const selRank=selected?getRank(selSets):null;
  const nextRank=selected?getNextRank(selSets):null;
  const prog=selRank&&nextRank?((selSets-selRank.min)/(nextRank.min-selRank.min))*100:100;
  const ranked=MUSCLE_GROUPS.map(mg=>({mg,sets:data[mg]||0,rank:getRank(data[mg]||0)})).filter(x=>x.sets>0).sort((a,b)=>b.sets-a.sets);
  return (
    <div className={C} style={s.card(T)}>
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest font-bold" style={{color:T.sub}}>Muscle Map</div>
          <div className="flex gap-1">
            {['week','alltime'].map(m=>(
              <button key={m} onClick={()=>setMode(m)} className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{background:mode===m?T.accent:T.inp,color:mode===m?'#fff':T.sub}}>{m==='week'?'Week':'All Time'}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-1">
          {['front','back'].map(v=>(
            <button key={v} onClick={()=>setView(v)} className="flex-1 py-1 rounded-lg text-xs font-bold capitalize" style={{background:view===v?T.inp:'transparent',color:view===v?T.text:T.sub}}>{v}</button>
          ))}
        </div>
      </div>
      <div className="px-4">
        <BodySVG muscleData={data} view={view} onSelect={setSelected} selected={selected} accent={T.accent}/>
      </div>
      {selected&&selRank&&(
        <div className="mx-4 mb-3 rounded-xl p-3 border" style={{background:`${selRank.color}18`,borderColor:`${selRank.color}44`}}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-black text-sm text-white">{selected}</div>
              <div className="text-xs font-bold" style={{color:selRank.color}}>{selRank.emoji} {selRank.name} · {selSets} sets</div>
            </div>
            {nextRank&&<div className="text-right"><div className="text-xs" style={{color:T.sub}}>Next: {nextRank.emoji} {nextRank.name}</div><div className="text-xs" style={{color:T.sub}}>{nextRank.min-selSets} sets away</div></div>}
          </div>
          {nextRank&&<div className="h-1.5 rounded-full overflow-hidden" style={{background:T.inp}}><div className="h-full rounded-full" style={{width:`${Math.min(prog,100)}%`,background:selRank.color}}/></div>}
        </div>
      )}
      {ranked.length>0&&(
        <div className="px-4 pb-2">
          <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{color:T.sub}}>Rankings</div>
          <div className="space-y-1.5">
            {ranked.map(({mg,sets,rank})=>{
              const nx=getNextRank(sets);const pg=nx?((sets-rank.min)/(nx.min-rank.min))*100:100;
              return (
                <button key={mg} onClick={()=>setSelected(mg===selected?null:mg)} className="w-full flex items-center gap-2 p-2 rounded-xl text-left" style={{background:selected===mg?T.inp:'transparent'}}>
                  <span className="text-sm w-5 text-center">{rank.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs font-bold" style={{color:T.text}}>{mg}</span>
                      <span className="text-xs font-black ml-2" style={{color:rank.color}}>{sets}s</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{background:T.inp}}><div className="h-full rounded-full" style={{width:`${Math.min(pg,100)}%`,background:rank.color}}/></div>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{color:rank.color,minWidth:52,textAlign:'right'}}>{rank.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="px-4 pb-4 mt-2">
        <div className="text-xs uppercase tracking-widest mb-2" style={{color:T.sub}}>Rank Key</div>
        <div className="grid grid-cols-4 gap-1">
          {RANKS.slice(1).map(r=>(
            <div key={r.name} className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg" style={{background:T.inp}}>
              <span className="text-sm">{r.emoji}</span>
              <span className="text-[9px] font-bold" style={{color:r.color}}>{r.name}</span>
              <span className="text-[8px]" style={{color:T.sub}}>{r.min}+</span>
            </div>
          ))}
        </div>
      </div>
      {ranked.length===0&&<div className="px-4 pb-4 text-xs text-center" style={{color:T.sub}}>{mode==='week'?'No workouts this week.':'Log workouts to build rankings.'}</div>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState('dashboard');
  const [workouts,setWorkouts]=useState(()=>lsGet(KEYS.workouts)||[]);
  const [bodyweight,setBW]=useState(()=>lsGet(KEYS.bodyweight)||[]);
  const [plans,setPlans]=useState(()=>lsGet(KEYS.plans)||DEFAULT_PLANS);
  const [schedule,setSched]=useState(()=>lsGet(KEYS.schedule)||DEFAULT_SCHEDULE);
  const [notes,setNotes]=useState(()=>lsGet(KEYS.notes)||[]);
  const [water,setWater]=useState(()=>{const w=lsGet(KEYS.water);return(w&&w.date===todayStr())?w:{date:todayStr(),cups:0};});
  const [themeKey,setThemeKey]=useState(()=>lsGet(KEYS.theme)||DEFAULT_THEME);
  const [activeWorkout,setActiveWorkout]=useState(null);
  const [milestone,setMilestone]=useState(null);

  const T = THEMES[themeKey] || THEMES[DEFAULT_THEME];

  useEffect(()=>{ lsSet(KEYS.workouts,workouts); },[workouts]);
  useEffect(()=>{ lsSet(KEYS.bodyweight,bodyweight); },[bodyweight]);
  useEffect(()=>{ lsSet(KEYS.plans,plans); },[plans]);
  useEffect(()=>{ lsSet(KEYS.schedule,schedule); },[schedule]);
  useEffect(()=>{ lsSet(KEYS.notes,notes); },[notes]);
  useEffect(()=>{ lsSet(KEYS.water,water); },[water]);
  useEffect(()=>{ lsSet(KEYS.theme,themeKey); },[themeKey]);
  useEffect(()=>{ document.body.style.background=T.bg; },[T]);

  const addWorkout=(w)=>{
    setWorkouts(prev=>{const next=[w,...prev];const streak=calcStreak(next);const m=getMilestone(streak);if(m)setMilestone(m);return next;});
  };
  const addCup=()=>setWater(w=>({...w,cups:Math.min(w.cups+1,20)}));
  const removeCup=()=>setWater(w=>({...w,cups:Math.max(w.cups-1,0)}));

  const exportCSV=()=>{
    const rows=[['Date','Workout','Exercise','Muscle','Sets','Reps','Weight','Volume']];
    workouts.forEach(w=>w.exercises?.forEach(e=>rows.push([w.date,w.name,e.name,e.muscleGroup,e.sets,e.reps,e.weight,e.sets*e.reps*e.weight])));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}));a.download='workouts.csv';a.click();
  };

  if(activeWorkout) {
    const plan = plans.find(p=>p.id===activeWorkout);
    if(!plan) return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{background:T.bg,color:T.text}}>
        <div className={C+' p-6'} style={s.card(T)}>
          <div className="text-lg font-black mb-2">Workout not found</div>
          <div className="text-sm mb-4" style={{color:T.sub}}>The selected workout could not be loaded. Tap back to return to your dashboard.</div>
          <button onClick={()=>setActiveWorkout(null)} className="px-5 py-3 rounded-2xl font-black text-white" style={{background:T.accent}}>Back</button>
        </div>
      </div>
    );
    return (
      <WorkoutSession plan={plan} workouts={workouts} T={T}
        onFinish={(w)=>{addWorkout(w);setActiveWorkout(null);}} onCancel={()=>setActiveWorkout(null)}/>
    );
  }

  const NAV=[
    {id:'dashboard',icon:<Home size={17}/>,label:'Home'},
    {id:'log',icon:<Dumbbell size={17}/>,label:'Log'},
    {id:'plans',icon:<Calendar size={17}/>,label:'Plans'},
    {id:'body',icon:<Scale size={17}/>,label:'Body'},
    {id:'notes',icon:<FileText size={17}/>,label:'Notes'},
    {id:'stats',icon:<BarChart2 size={17}/>,label:'Stats'},
    {id:'settings',icon:<Palette size={17}/>,label:'Theme'},
  ];

  return (
    <div className="min-h-screen font-mono max-w-md mx-auto relative" style={{background:T.bg,color:T.text}}>
      {milestone&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className={C+' p-8 mx-6 text-center'} style={{...s.card(T),borderColor:T.accent,borderWidth:2}}>
            <div className="text-5xl mb-3">🏆</div>
            <div className="text-2xl font-black mb-1" style={{color:T.text}}>{milestone} WEEK{milestone===1?'':'S'}!</div>
            <div className="text-sm mb-6" style={{color:T.sub}}>Consistency milestone. Keep going.</div>
            <button onClick={()=>setMilestone(null)} className="px-8 py-3 rounded-2xl font-black text-white" style={{background:T.accent}}>LET'S GO</button>
          </div>
        </div>
      )}
      <div className="pb-20">
        {tab==='dashboard'&&<DashboardTab workouts={workouts} plans={plans} schedule={schedule} onStart={setActiveWorkout} bodyweight={bodyweight} water={water} addCup={addCup} removeCup={removeCup} T={T}/>}
        {tab==='log'&&<LogTab workouts={workouts} addWorkout={addWorkout} delWorkout={(id)=>setWorkouts(p=>p.filter(w=>w.id!==id))} plans={plans} T={T} exportCSV={exportCSV}/>}
        {tab==='plans'&&<PlansTab plans={plans} setPlans={setPlans} schedule={schedule} setSched={setSched} onStart={setActiveWorkout} T={T}/>}
        {tab==='body'&&<BodyTab bodyweight={bodyweight} setBW={setBW} workouts={workouts} T={T}/>}
        {tab==='notes'&&<NotesTab notes={notes} setNotes={setNotes} T={T}/>}
        {tab==='stats'&&<StatsTab workouts={workouts} T={T} exportCSV={exportCSV}/>}
        {tab==='settings'&&<SettingsTab themeKey={themeKey} setThemeKey={setThemeKey} T={T}/>}
      </div>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md flex border-t" style={{background:T.nav,borderColor:T.border}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-bold transition-all" style={{color:tab===n.id?T.accent:T.sub}}>
            {n.icon}<span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({themeKey,setThemeKey,T}) {
  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h2 className="text-2xl font-black" style={{color:T.text}}>THEME</h2>
        <div className="text-xs mt-1" style={{color:T.sub}}>Full environment — background, cards, accent.</div>
      </div>
      <div className="space-y-3">
        {Object.entries(THEMES).map(([key,t])=>{
          const active=themeKey===key;
          return (
            <button key={key} onClick={()=>setThemeKey(key)} className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all" style={{background:t.card,borderColor:active?t.accent:t.border}}>
              <div className="w-12 h-9 rounded-xl overflow-hidden border flex-shrink-0" style={{borderColor:t.border,background:t.bg}}>
                <div className="h-full flex flex-col p-1 gap-1">
                  <div className="flex-1 rounded" style={{background:t.card}}/>
                  <div className="h-1 rounded-full" style={{background:t.accent}}/>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black flex items-center gap-1.5 text-sm" style={{color:t.text}}><span>{t.emoji}</span><span>{t.name}</span></div>
                <div className="text-xs truncate" style={{color:t.sub}}>{t.desc}</div>
              </div>
              {active&&<Check size={16} style={{color:t.accent,flexShrink:0}}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({workouts,plans,schedule,onStart,bodyweight,water,addCup,removeCup,T}) {
  const dow=new Date().getDay();
  const todayPlan=plans.find(p=>p.id===schedule[dow]);
  const tomorrowPlan=plans.find(p=>p.id===schedule[(dow+1)%7]);
  const prs=getPRs(workouts).slice(0,3);
  const streak=calcStreak(workouts);
  const weekVol=calcWeekVol(workouts);
  const lastBW=bodyweight[bodyweight.length-1];
  const [qi,setQi]=useState(()=>Math.floor(Date.now()/86400000)%QUOTES.length);
  const q=QUOTES[qi];
  const data7=useMemo(()=>calc7Days(workouts),[workouts]);
  return (
    <div className="p-4 space-y-4">
      <div className="pt-4 pb-1">
        <div className="text-xs uppercase tracking-widest" style={{color:T.sub}}>Today</div>
        <div className="text-2xl font-black" style={{color:T.text}}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</div>
      </div>
      {/* Quote */}
      <div className={C+' p-4 relative overflow-hidden'} style={s.card(T)}>
        <div className="absolute top-3 right-3 opacity-10"><Quote size={28} style={{color:T.accent}}/></div>
        <div className="text-sm leading-relaxed italic mb-2" style={{color:T.text}}>{'"'}{q.t}{'"'}</div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold" style={{color:T.accent}}>— {q.a}</div>
          <button onClick={()=>setQi(i=>(i+1)%QUOTES.length)} className="p-1.5 rounded-lg" style={{background:T.inp}}><RefreshCw size={11} style={{color:T.sub}}/></button>
        </div>
      </div>
      {/* Today plan */}
      <div className={C+' p-4'} style={s.card(T)}>
        <div className="text-xs uppercase tracking-widest mb-2" style={{color:T.sub}}>Today's Workout</div>
        {todayPlan?(
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl font-black" style={{color:todayPlan.color}}>{todayPlan.name}</span>
              <span className="text-sm" style={{color:T.sub}}>{todayPlan.exercises.length} ex</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {[...new Set(todayPlan.exercises.map(e=>e.muscleGroup))].map(mg=>(
                <span key={mg} className="text-xs px-2 py-0.5 rounded-full" style={{background:T.inp,color:T.text}}>{mg}</span>
              ))}
            </div>
            <button onClick={()=>onStart(todayPlan.id)} className="w-full py-3 rounded-xl font-black text-white flex items-center justify-center gap-2" style={{background:todayPlan.color}}>
              <Play size={15} fill="white"/> START WORKOUT
            </button>
          </>
        ):
          <div className="text-sm" style={{color:T.sub}}>Rest day — no workout scheduled.</div>
        }
      </div>
      {tomorrowPlan&&(
        <div className={C+' p-3 flex items-center justify-between'} style={s.card(T)}>
          <div><div className="text-xs uppercase tracking-widest" style={{color:T.sub}}>Tomorrow</div><div className="font-black" style={{color:tomorrowPlan.color}}>{tomorrowPlan.name}</div></div>
          <ArrowRight size={15} style={{color:T.sub}}/>
        </div>
      )}
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[{icon:<Flame size={15}/>,val:streak,label:'wk streak'},{icon:<Activity size={15}/>,val:fmt(weekVol),label:'lbs/week'},{icon:<Scale size={15}/>,val:lastBW?lastBW.weight:'--',label:'lbs'}].map((x,i)=>(
          <div key={i} className={C+' p-3'} style={s.card(T)}>
            <div style={{color:T.accent}} className="mb-1">{x.icon}</div>
            <div className="text-2xl font-black" style={{color:T.text}}>{x.val}</div>
            <div className="text-xs" style={{color:T.sub}}>{x.label}</div>
          </div>
        ))}
      </div>
      {/* Water */}
      <div className={C+' p-4'} style={s.card(T)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5"><Droplets size={14} style={{color:'#67e8f9'}}/><span className="text-xs uppercase tracking-widest" style={{color:T.sub}}>Water</span></div>
          <span className="text-sm font-black" style={{color:T.text}}>{water.cups}/{WATER_GOAL}</span>
        </div>
        <div className="flex gap-1 mb-2">
          {Array.from({length:WATER_GOAL}).map((_,i)=><div key={i} className="flex-1 h-2.5 rounded-full" style={{background:i<water.cups?'#67e8f9':T.inp}}/>)}
        </div>
        <div className="flex gap-2">
          <button onClick={removeCup} className="flex-1 py-2 rounded-xl font-black text-lg" style={{background:T.inp,color:T.sub}}>−</button>
          <button onClick={addCup} className="flex-1 py-2 rounded-xl font-black text-sm text-white flex items-center justify-center gap-1" style={{background:'#0891b2'}}><Droplets size={13}/> Cup</button>
        </div>
      </div>
      {/* Heat map */}
      <MuscleHeatMap workouts={workouts} T={T}/>
      {/* PRs */}
      {prs.length>0&&(
        <div className={C+' p-4'} style={s.card(T)}>
          <div className="flex items-center gap-2 mb-3"><Award size={14} style={{color:'#eab308'}}/><span className="text-xs uppercase tracking-widest" style={{color:T.sub}}>Recent PRs</span></div>
          <div className="space-y-2">
            {prs.map((pr,i)=>(
              <div key={i} className="flex items-center justify-between">
                <div><span className="text-sm font-bold" style={{color:T.text}}>{pr.exercise}</span><span className="ml-2 text-xs" style={{color:T.sub}}>~{epley(pr.weight,pr.reps)}lbs 1RM</span></div>
                <span className="text-sm font-black" style={{color:'#eab308'}}>{pr.weight}×{pr.reps}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 7-day vol */}
      <div className={C+' p-4'} style={s.card(T)}>
        <div className="text-xs uppercase tracking-widest mb-3" style={{color:T.sub}}>7-Day Volume</div>
        <ResponsiveContainer width="100%" height={75}>
          <BarChart data={data7} barSize={14}>
            <Bar dataKey="vol" fill={T.accent} radius={[3,3,0,0]}/>
            <XAxis dataKey="day" tick={{fill:T.sub,fontSize:9}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:11}} formatter={v=>[`${fmt(v)} lbs`]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────
function LogTab({workouts,addWorkout,delWorkout,plans,T,exportCSV}) {
  const [showNew,setShowNew]=useState(false);
  const [showQuick,setShowQuick]=useState(false);
  const getOL=(name)=>{const h=getExHist(workouts,name);if(h.length<2)return false;const[l,p]=h;return l.sets>=p.sets&&l.weight>=p.weight&&l.reps>=p.reps;};
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h2 className="text-2xl font-black" style={{color:T.text}}>WORKOUT LOG</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="p-2 rounded-xl" style={{background:T.card,color:T.sub}}><Download size={15}/></button>
          <button onClick={()=>setShowQuick(true)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{background:T.card,color:T.text}}>Quick</button>
          <button onClick={()=>setShowNew(true)} className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{background:T.accent}}><Plus size={19}/></button>
        </div>
      </div>
      {showQuick&&<QuickLogForm T={T} onSave={w=>{addWorkout(w);setShowQuick(false);}} onCancel={()=>setShowQuick(false)}/>}
      {showNew&&<NewWorkoutForm T={T} onSave={w=>{addWorkout(w);setShowNew(false);}} onCancel={()=>setShowNew(false)}/>}
      {workouts.length===0&&!showNew&&!showQuick&&<div className="text-center py-12" style={{color:T.sub}}><Dumbbell size={38} className="mx-auto mb-3 opacity-30"/><div>No workouts yet.</div></div>}
      <div className="space-y-3">{workouts.map(w=><WorkoutCard key={w.id} workout={w} getOL={getOL} onDelete={()=>delWorkout(w.id)} T={T}/> )}</div>
    </div>
  );
}

function QuickLogForm({T,onSave,onCancel}) {
  const [name,setName]=useState('');const[mg,setMg]=useState('Chest');const[sets,setSets]=useState(3);const[reps,setReps]=useState(10);const[wt,setWt]=useState(0);
  const save=()=>{if(!name.trim())return;onSave({id:uid(),name:`Quick: ${name}`,date:todayStr(),exercises:[{name,muscleGroup:mg,sets,reps,weight:wt}]});};
  return (
    <div className={C+' p-4 space-y-3'} style={{...s.card(T),borderColor:T.accent}}>
      <div className="text-sm font-black uppercase tracking-widest" style={{color:T.accent}}>Quick Log</div>
      <input placeholder="Exercise name" value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl px-4 py-3 font-bold border outline-none" style={s.inp(T)}/>
      <select value={mg} onChange={e=>setMg(e.target.value)} className="w-full rounded-xl px-4 py-2.5 border outline-none" style={s.inp(T)}>
        {MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}
      </select>
      <div className="grid grid-cols-3 gap-2">
        {[['Sets',sets,setSets],['Reps',reps,setReps],['Wt',wt,setWt]].map(([l,v,fn])=>(
          <div key={l}><div className="text-xs uppercase mb-1" style={{color:T.sub}}>{l}</div>
          <input type="number" value={v} onChange={e=>fn(Number(e.target.value)||0)} className="w-full rounded-lg px-2 py-2 text-sm border outline-none text-center font-bold" style={s.inp(T)}/></div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{background:T.inp,color:T.sub}}>Cancel</button>
        <button onClick={save} className="flex-1 py-3 rounded-xl font-black text-sm text-white" style={{background:T.accent}}>Log It</button>
      </div>
    </div>
  );
}

function WorkoutCard({workout,getOL,onDelete,T}) {
  const [open,setOpen]=useState(false);
  const vol=workout.exercises?.reduce((a,e)=>a+(e.sets*e.reps*e.weight),0)??0;
  return (
    <div className={C+' overflow-hidden'} style={s.card(T)}>
      <button className="w-full p-4 flex items-center justify-between" onClick={()=>setOpen(o=>!o)}>
        <div className="text-left"><div className="font-black" style={{color:T.text}}>{workout.name}</div><div className="text-xs" style={{color:T.sub}}>{workout.date} · {fmt(vol)} lbs</div></div>
        {open?<ChevronUp size={15} style={{color:T.sub}}/>:<ChevronDown size={15} style={{color:T.sub}}/>}
      </button>
      {open&&(
        <div className="px-4 pb-4 space-y-2 pt-3" style={{borderTop:`1px solid ${T.border}`}}>
          {workout.exercises?.map((ex,i)=>(
            <div key={i} className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold flex items-center gap-1" style={{color:T.text}}>
                  {ex.name}
                  {getOL(ex.name)&&<span className="text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold" style={{background:T.am,color:T.accent}}><ArrowUp size={9}/>OL</span>}
                </div>
                <div className="text-xs" style={{color:T.sub}}>{ex.muscleGroup} · ~{epley(ex.weight,ex.reps)}lbs 1RM</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black" style={{color:T.accent}}>{ex.weight>0?`${ex.weight}lbs`:'BW'}</div>
                <div className="text-xs" style={{color:T.sub}}>{ex.sets}×{ex.reps}</div>
              </div>
            </div>
          ))}
          <button onClick={onDelete} className="mt-1 text-xs flex items-center gap-1" style={{color:'#f87171'}}><Trash2 size={11}/> Delete</button>
        </div>
      )}
    </div>
  );
}

function NewWorkoutForm({T,onSave,onCancel}) {
  const [name,setName]=useState(`Workout ${new Date().toLocaleDateString()}`);
  const [exs,setExs]=useState([{id:uid(),name:'',muscleGroup:'Chest',sets:3,reps:10,weight:0}]);
  const add=()=>setExs(e=>[...e,{id:uid(),name:'',muscleGroup:'Chest',sets:3,reps:10,weight:0}]);
  const rem=(id)=>setExs(e=>e.filter(x=>x.id!==id));
  const upd=(id,f,v)=>setExs(e=>e.map(x=>x.id===id?{...x,[f]:['sets','reps','weight'].includes(f)?Number(v)||0:v}:x));
  return (
    <div className={C+' p-4 space-y-3'} style={{...s.card(T),borderColor:T.accent+'80'}}>
      <div className="text-sm font-black uppercase tracking-widest" style={{color:T.accent}}>New Workout</div>
      <input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl px-4 py-3 font-bold border outline-none" style={s.inp(T)}/>
      {exs.map(ex=>(
        <div key={ex.id} className="rounded-xl p-3 space-y-2 border" style={{background:T.inp,borderColor:T.border}}>
          <div className="flex gap-2">
            <input placeholder="Exercise name" value={ex.name} onChange={e=>upd(ex.id,'name',e.target.value)} className="flex-1 rounded-lg px-3 py-2 text-sm border outline-none" style={{background:T.card,color:T.text,borderColor:T.border}}/>
            <button onClick={()=>rem(ex.id)} style={{color:'#f87171'}} className="p-2"><Trash2 size={13}/></button>
          </div>
          <select value={ex.muscleGroup} onChange={e=>upd(ex.id,'muscleGroup',e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border outline-none" style={{background:T.card,color:T.text,borderColor:T.border}}>
            {MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {['sets','reps','weight'].map(f=>(
              <div key={f}><div className="text-xs uppercase mb-1" style={{color:T.sub}}>{f}</div>
              <input type="number" value={ex[f]} onChange={e=>upd(ex.id,f,e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm border outline-none text-center font-bold" style={{background:T.card,color:T.text,borderColor:T.border}}/></div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={add} className="w-full py-3 rounded-xl border border-dashed text-sm flex items-center justify-center gap-2" style={{borderColor:T.border,color:T.sub}}><Plus size={13}/> Add Exercise</button>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{background:T.inp,color:T.sub}}>Cancel</button>
        <button onClick={()=>onSave({id:uid(),name,date:todayStr(),exercises:exs})} className="flex-1 py-3 rounded-xl font-black text-sm text-white" style={{background:T.accent}}>Save</button>
      </div>
    </div>
  );
}

// ─── Workout Session ──────────────────────────────────────────────────────────
function WorkoutSession({plan,workouts,T,onFinish,onCancel}) {
  const [exIdx,setExIdx]=useState(0);
  const [setIdx,setSetIdx]=useState(0);
  const [resting,setResting]=useState(false);
  const [done,setDone]=useState([]);
  const [weight,setWeight]=useState(null);
  const [prevWeight,setPrevWeight]=useState(null);
  const [reps,setReps]=useState(null);
  const [finished,setFinished]=useState(false);
  const [swapOpen,setSwapOpen]=useState(false);
  const [exs,setExs]=useState(()=>plan.exercises.map(e=>({...e})));
  const ex=exs[exIdx];
  const totalSets=exs.reduce((a,e)=>a+e.sets,0);
  const doneSets=done.reduce((a,d)=>a+d.sets,0)+setIdx;
  useEffect(()=>{
    if(ex){
      setWeight(ex.weight);
      setPrevWeight(null);
      setReps(ex.reps);
    }
  },[exIdx, ex?.weight, ex?.reps]);
  const updateWeight = (next) => { setPrevWeight(weight); setWeight(next); };
  const logSet=()=>{
    if(setIdx+1<ex.sets){setSetIdx(s=>s+1);setResting(true);}
    else{
      setDone(d=>[...d,{exName:ex.name,muscleGroup:ex.muscleGroup,sets:ex.sets,reps:Number(reps)||ex.reps,weight:Number(weight)||ex.weight}]);
      setSetIdx(0);
      if(exIdx+1<exs.length){setExIdx(i=>i+1);setResting(true);}else setFinished(true);
    }
  };
  const skipExercise = () => {
    setSetIdx(0);
    if(exIdx+1<exs.length){
      setExIdx(i=>i+1);
      setResting(true);
    } else setFinished(true);
  };
  const hist=getExHist(workouts,ex?.name||'');const lastTime=hist[0];
  const alts=ALTS[ex?.name]||['Dumbbell variation','Machine variation','Bodyweight variation'];

  if(finished) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{background:T.bg}}>
      <div className="text-5xl mb-3">🔥</div>
      <div className="text-3xl font-black mb-1" style={{color:T.text}}>WORKOUT DONE</div>
      <div className="text-sm mb-5" style={{color:T.sub}}>{done.length} exercises · {done.reduce((a,d)=>a+d.sets,0)} sets</div>
      <div className={C+' w-full p-4 mb-5 space-y-2'} style={s.card(T)}>
        {done.map((d,i)=>(
          <div key={i} className="flex justify-between text-sm">
            <span className="font-bold" style={{color:T.text}}>{d.exName}</span>
            <span className="font-black" style={{color:T.accent}}>{d.weight>0?`${d.weight}lbs`:'BW'} ×{d.reps}</span>
          </div>
        ))}
      </div>
      <button onClick={()=>onFinish({id:uid(),name:plan.name,date:todayStr(),planId:plan.id,exercises:done})}
        className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{background:T.accent}}>SAVE WORKOUT</button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{background:T.bg}}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <button onClick={onCancel} className="p-2 rounded-xl" style={{background:T.card}}><X size={18} style={{color:T.text}}/></button>
        <div className="text-center">
          <div className="font-black text-sm" style={{color:plan.color}}>{plan.name}</div>
          <div className="text-xs" style={{color:T.sub}}>Ex {exIdx+1}/{exs.length} · Set {setIdx+1}/{ex.sets}</div>
        </div>
        <button onClick={()=>setSwapOpen(o=>!o)} className="p-2 rounded-xl" style={{background:T.card,color:T.sub}}><Shuffle size={15}/></button>
      </div>
      {/* Progress */}
      <div className="mx-4 h-1.5 rounded-full mb-3 overflow-hidden" style={{background:T.inp}}>
        <div className="h-full rounded-full transition-all duration-500" style={{width:`${totalSets>0?(doneSets/totalSets)*100:0}%`,background:T.accent}}/>
      </div>
      {/* Swap */}
      {swapOpen&&(
        <div className={C+' mx-4 p-4 mb-3'} style={s.card(T)}>
          <div className="text-xs uppercase tracking-widest mb-3" style={{color:T.sub}}>Swap Exercise</div>
          <div className="space-y-2">
            {alts.map(a=>(
              <button key={a} onClick={()=>{setExs(p=>p.map((e,i)=>i===exIdx?{...e,name:a}:e));setSwapOpen(false);}}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold" style={{background:T.inp,color:T.text}}>{a}</button>
            ))}
          </div>
          <button onClick={()=>setSwapOpen(false)} className="mt-2 w-full py-2 rounded-xl text-sm font-bold" style={{background:T.inp,color:T.sub}}>Cancel</button>
        </div>
      )}
      <div className="flex-1 flex flex-col px-4 gap-3 pb-6">
        {/* Exercise card */}
        <div className={C+' p-4'} style={s.card(T)}>
          <div className="text-xl font-black" style={{color:T.text}}>{ex.name}</div>
          <div className="text-sm" style={{color:T.sub}}>{ex.muscleGroup}</div>
          {lastTime&&<div className="mt-1.5 text-xs flex items-center gap-1" style={{color:'#67e8f9'}}><TrendingUp size={9}/> Last: {lastTime.weight>0?`${lastTime.weight}lbs`:'BW'} × {lastTime.sets}×{lastTime.reps}</div>}
        </div>
        {resting?(
          <div className={C+' p-4 flex-1 flex flex-col items-center justify-center'} style={s.card(T)}>
            <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{color:T.sub}}>Rest</div>
            <RestTimer onDone={()=>setResting(false)} accent={T.accent}/>
          </div>
        ):(
          <>
            {/* Weight & Reps — compact, fits on phone */}
            <div className="grid grid-cols-2 gap-3">
              {/* Weight */}
              <div className={C+' p-3'} style={s.card(T)}>
                <div className="text-xs uppercase tracking-widest mb-2 text-center font-bold" style={{color:T.sub}}>Weight (lbs)</div>
                <div className="flex items-center gap-1 mb-2">
                  <button onClick={()=>updateWeight(Math.max(0,(Number(weight)||0) - 5))} className="w-10 h-10 rounded-xl font-black text-xl flex items-center justify-center flex-shrink-0" style={{background:T.inp,color:T.text}}>−</button>
                  <input type="number" value={weight??''} onChange={e=>updateWeight(e.target.value)} className="w-0 flex-1 bg-transparent text-center font-black outline-none" style={{color:T.accent,fontSize:'1.4rem'}}/>
                  <button onClick={()=>updateWeight((Number(weight)||0) + 5)} className="w-10 h-10 rounded-xl font-black text-xl flex items-center justify-center flex-shrink-0" style={{background:T.inp,color:T.text}}>+</button>
                </div>
                <div className="flex gap-1 mb-2">
                  {[-10,-5,5,10].map(d=>(
                    <button key={d} onClick={()=>updateWeight(Math.max(0,(Number(weight)||0) + d))} className="flex-1 py-1 rounded-lg text-xs font-bold" style={{background:T.inp,color:d>0?T.accent:T.sub}}>{d>0?`+${d}`:d}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>prevWeight!==null&&setWeight(prevWeight)} disabled={prevWeight===null}
                    className="flex-1 py-2 rounded-xl text-xs font-bold" style={{background:T.inp,color:prevWeight===null?T.sub:T.accent,border:prevWeight===null?`1px solid ${T.border}`:`1px solid ${T.accent}`}}>Undo</button>
                  <button onClick={()=>{setPrevWeight(weight); setWeight(ex.weight);}} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{background:T.inp,color:T.sub,border:`1px solid ${T.border}`}}>Reset</button>
                </div>
              </div>
              {/* Reps */}
              <div className={C+' p-3'} style={s.card(T)}>
                <div className="text-xs uppercase tracking-widest mb-2 text-center font-bold" style={{color:T.sub}}>Reps</div>
                <div className="flex items-center gap-1 mb-2">
                  <button onClick={()=>setReps(v=>Math.max(1,Number(v)-1))} className="w-10 h-10 rounded-xl font-black text-xl flex items-center justify-center flex-shrink-0" style={{background:T.inp,color:T.text}}>−</button>
                  <input type="number" value={reps??''} onChange={e=>setReps(e.target.value)} className="w-0 flex-1 bg-transparent text-center font-black outline-none" style={{color:T.accent,fontSize:'1.4rem'}}/>
                  <button onClick={()=>setReps(v=>Number(v)+1)} className="w-10 h-10 rounded-xl font-black text-xl flex items-center justify-center flex-shrink-0" style={{background:T.inp,color:T.text}}>+</button>
                </div>
                <div className="flex gap-1">
                  {[-2,-1,1,2].map(d=>(
                    <button key={d} onClick={()=>setReps(v=>Math.max(1,Number(v)+d))} className="flex-1 py-1 rounded-lg text-xs font-bold" style={{background:T.inp,color:d>0?T.accent:T.sub}}>{d>0?`+${d}`:d}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={logSet} className="w-full py-5 rounded-2xl font-black text-xl text-white flex items-center justify-center gap-2" style={{background:plan.color}}>
              <Check size={21}/> LOG SET
            </button>
            <button onClick={skipExercise} className="w-full mt-3 py-3 rounded-xl font-bold text-sm" style={{background:T.inp,color:T.sub,border:`1px solid ${T.border}`}}>Skip Exercise</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────
function PlansTab({plans,setPlans,schedule,setSched,onStart,T}) {
  const [editing,setEditing]=useState(null);
  const [schedOpen,setSchedOpen]=useState(false);
  const del=(id)=>{setPlans(p=>p.filter(x=>x.id!==id));setSched(s=>{const n={...s};Object.keys(n).forEach(k=>{if(n[k]===id)n[k]=null;});return n;});};
  if(editing) return <PlanEditor plan={editing==='new'?{id:uid(),name:'',color:T.accent,exercises:[]}:plans.find(p=>p.id===editing)} T={T}
    onSave={p=>{setPlans(prev=>editing==='new'?[...prev,p]:prev.map(x=>x.id===p.id?p:x));setEditing(null);}} onCancel={()=>setEditing(null)}/>;
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h2 className="text-2xl font-black" style={{color:T.text}}>PLANS</h2>
        <button onClick={()=>setEditing('new')} className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{background:T.accent}}><Plus size={19}/></button>
      </div>
      <div className={C+' overflow-hidden'} style={s.card(T)}>
        <button className="w-full p-4 flex items-center justify-between" onClick={()=>setSchedOpen(o=>!o)}>
          <span className="font-black flex items-center gap-2" style={{color:T.text}}><Calendar size={15} style={{color:T.accent}}/> Weekly Schedule</span>
          {schedOpen?<ChevronUp size={15} style={{color:T.sub}}/>:<ChevronDown size={15} style={{color:T.sub}}/>}
        </button>
        {schedOpen&&(
          <div className="px-4 pb-4 grid grid-cols-7 gap-1" style={{borderTop:`1px solid ${T.border}`}}>
            {[0,1,2,3,4,5,6].map(d=>{
              const plan=plans.find(p=>p.id===schedule[d]);
              return (
                <div key={d} className="flex flex-col items-center gap-1 pt-3">
                  <div className="text-xs" style={{color:T.sub}}>{dayName(d)}</div>
                  <select value={schedule[d]||''} onChange={e=>setSched(ss=>({...ss,[d]:e.target.value||null}))}
                    className="w-full text-xs rounded-lg py-1 border outline-none text-center" style={{background:T.inp,color:plan?.color||T.sub,borderColor:T.border}}>
                    <option value="">—</option>
                    {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {plans.map(plan=>(
        <div key={plan.id} className={C+' p-4'} style={s.card(T)}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-black text-lg" style={{color:plan.color}}>{plan.name}</div>
            <div className="flex gap-2">
              <button onClick={()=>setEditing(plan.id)} className="p-2 rounded-xl" style={{background:T.inp,color:T.sub}}><Edit2 size={13}/></button>
              <button onClick={()=>del(plan.id)} className="p-2 rounded-xl" style={{background:T.inp,color:'#f87171'}}><Trash2 size={13}/></button>
            </div>
          </div>
          {plan.exercises.map((ex,i)=>(
            <div key={i} className="flex justify-between text-sm py-0.5">
              <span style={{color:T.text}}>{ex.name}</span>
              <span style={{color:T.sub}}>{ex.sets}×{ex.reps} @ {ex.weight>0?`${ex.weight}lbs`:'BW'}</span>
            </div>
          ))}
          <button onClick={()=>onStart(plan.id)} className="mt-3 w-full py-3 rounded-xl font-black text-white flex items-center justify-center gap-2" style={{background:plan.color}}>
            <Play size={15} fill="white"/> START WORKOUT
          </button>
        </div>
      ))}
    </div>
  );
}

function PlanEditor({plan,T,onSave,onCancel}) {
  const [p,setP]=useState({...plan,exercises:plan.exercises.map(e=>({...e}))});
  const add=()=>setP(x=>({...x,exercises:[...x.exercises,{id:uid(),name:'',muscleGroup:'Chest',sets:3,reps:10,weight:0}]}));
  const rem=(id)=>setP(x=>({...x,exercises:x.exercises.filter(e=>e.id!==id)}));
  const upd=(id,f,v)=>setP(x=>({...x,exercises:x.exercises.map(e=>e.id===id?{...e,[f]:['sets','reps','weight'].includes(f)?Number(v)||0:v}:e)}));
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pt-4">
        <button onClick={onCancel} className="p-2 rounded-xl" style={{background:T.card}}><ChevronLeft size={17} style={{color:T.text}}/></button>
        <h2 className="text-xl font-black" style={{color:T.text}}>EDIT PLAN</h2>
      </div>
      <input placeholder="Plan name" value={p.name} onChange={e=>setP(x=>({...x,name:e.target.value}))} className="w-full rounded-xl px-4 py-3 font-bold border outline-none" style={s.inp(T)}/>
      <div><div className="text-xs uppercase mb-2" style={{color:T.sub}}>Color</div>
        <div className="flex gap-2">{PLAN_COLORS.map(c=>(
          <button key={c} onClick={()=>setP(x=>({...x,color:c}))} className="w-8 h-8 rounded-full border-2 transition-all" style={{background:c,borderColor:p.color===c?'#fff':'transparent'}}/>
        ))}</div>
      </div>
      <div className="space-y-3">
        {p.exercises.map(ex=>(
          <div key={ex.id} className="rounded-xl p-3 space-y-2 border" style={{background:T.card,borderColor:T.border}}>
            <div className="flex gap-2">
              <input placeholder="Exercise name" value={ex.name} onChange={e=>upd(ex.id,'name',e.target.value)} className="flex-1 rounded-lg px-3 py-2 text-sm border outline-none" style={{background:T.inp,color:T.text,borderColor:T.border}}/>
              <button onClick={()=>rem(ex.id)} style={{color:'#f87171'}} className="p-2"><Trash2 size={13}/></button>
            </div>
            <select value={ex.muscleGroup} onChange={e=>upd(ex.id,'muscleGroup',e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border outline-none" style={{background:T.inp,color:T.text,borderColor:T.border}}>
              {MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              {['sets','reps','weight'].map(f=>(
                <div key={f}><div className="text-xs uppercase mb-1" style={{color:T.sub}}>{f}</div>
                <input type="number" value={ex[f]} onChange={e=>upd(ex.id,f,e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm border outline-none text-center font-bold" style={{background:T.inp,color:T.text,borderColor:T.border}}/></div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={add} className="w-full py-3 rounded-xl border border-dashed text-sm flex items-center justify-center gap-2" style={{borderColor:T.border,color:T.sub}}><Plus size={13}/> Add Exercise</button>
      </div>
      <div className="flex gap-2 pb-4">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold" style={{background:T.inp,color:T.sub}}>Cancel</button>
        <button onClick={()=>onSave(p)} className="flex-1 py-3 rounded-xl font-black text-white" style={{background:T.accent}}>Save Plan</button>
      </div>
    </div>
  );
}

// ─── Body Tab ─────────────────────────────────────────────────────────────────
function BodyTab({bodyweight,setBW,workouts,T}) {
  const [input,setInput]=useState('');
  const addEntry=()=>{const w=parseFloat(input);if(!w)return;setBW(b=>[...b,{date:todayStr(),weight:w}]);setInput('');};
  const chartData=bodyweight.slice(-30).map(b=>({date:b.date.slice(5),w:b.weight}));
  const latest=bodyweight[bodyweight.length-1];const prev=bodyweight[bodyweight.length-2];
  const diff=latest&&prev?(latest.weight-prev.weight).toFixed(1):null;
  const muscleRest=useMemo(()=>{const last={};[...workouts].sort((a,b)=>b.date.localeCompare(a.date)).forEach(w=>w.exercises?.forEach(e=>{if(!last[e.muscleGroup])last[e.muscleGroup]=daysSince(w.date);}));return last;},[workouts]);
  return (
    <div className="p-4 space-y-4">
      <div className="pt-4"><h2 className="text-2xl font-black" style={{color:T.text}}>BODY</h2></div>
      <div className={C+' p-4 flex gap-3'} style={s.card(T)}>
        <input type="number" placeholder="Weight (lbs)" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addEntry()}
          className="flex-1 rounded-xl px-4 py-3 font-bold border outline-none text-lg" style={s.inp(T)}/>
        <button onClick={addEntry} className="px-5 py-3 rounded-xl font-black text-white" style={{background:T.accent}}>LOG</button>
      </div>
      {latest&&(
        <div className="grid grid-cols-2 gap-3">
          <div className={C+' p-4'} style={s.card(T)}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{color:T.sub}}>Current</div>
            <div className="text-3xl font-black" style={{color:T.text}}>{latest.weight}<span className="text-sm ml-1" style={{color:T.sub}}>lbs</span></div>
            <div className="text-xs" style={{color:T.sub}}>{latest.date}</div>
          </div>
          <div className={C+' p-4'} style={s.card(T)}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{color:T.sub}}>Change</div>
            <div className="text-3xl font-black" style={{color:diff>0?'#f87171':diff<0?'#4ade80':T.text}}>{diff!==null?(diff>0?`+${diff}`:diff):'--'}<span className="text-sm ml-1" style={{color:T.sub}}>lbs</span></div>
          </div>
        </div>
      )}
      {chartData.length>1&&(
        <div className={C+' p-4'} style={s.card(T)}>
          <div className="text-xs uppercase tracking-widest mb-3" style={{color:T.sub}}>30-Day Trend</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="date" tick={{fill:T.sub,fontSize:9}} axisLine={false} tickLine={false} interval={4}/>
              <YAxis tick={{fill:T.sub,fontSize:9}} axisLine={false} tickLine={false} domain={['auto','auto']} width={33}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:11}} formatter={v=>[`${v} lbs`]}/>
              <Line type="monotone" dataKey="w" stroke={T.accent} strokeWidth={2} dot={false} activeDot={{r:4,fill:T.accent}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <MuscleHeatMap workouts={workouts} T={T}/>
      {Object.keys(muscleRest).length>0&&(
        <div className={C+' overflow-hidden'} style={s.card(T)}>
          <div className="p-4 text-xs uppercase tracking-widest flex items-center gap-2" style={{color:T.sub,borderBottom:`1px solid ${T.border}`}}><AlarmClock size={12}/> Days Since Trained</div>
          {Object.entries(muscleRest).sort((a,b)=>b[1]-a[1]).map(([mg,days])=>(
            <div key={mg} className="flex justify-between items-center px-4 py-2.5" style={{borderBottom:`1px solid ${T.border}`}}>
              <span className="text-sm" style={{color:T.text}}>{mg}</span>
              <span className="text-sm font-black" style={{color:days>=5?'#f87171':days>=3?'#eab308':'#4ade80'}}>{days===0?'Today':`${days}d ago`}{days>=5?' ⚠':''}</span>
            </div>
          ))}
        </div>
      )}
      <div className={C+' overflow-hidden'} style={s.card(T)}>
        <div className="p-4 text-xs uppercase tracking-widest" style={{color:T.sub,borderBottom:`1px solid ${T.border}`}}>History</div>
        {bodyweight.length===0&&<div className="p-4 text-sm" style={{color:T.sub}}>No entries yet.</div>}
        {[...bodyweight].reverse().slice(0,15).map((b,i)=>(
          <div key={i} className="flex justify-between px-4 py-3" style={{borderBottom:`1px solid ${T.border}`}}>
            <span className="text-sm" style={{color:T.sub}}>{b.date}</span>
            <span className="text-sm font-black" style={{color:T.text}}>{b.weight} lbs</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────
function NotesTab({notes,setNotes,T}) {
  const [text,setText]=useState('');const[editId,setEditId]=useState(null);const[editText,setEditText]=useState('');
  const add=()=>{if(!text.trim())return;setNotes(n=>[{id:uid(),text:text.trim(),ts:Date.now()},...n]);setText('');};
  const del=(id)=>setNotes(n=>n.filter(x=>x.id!==id));
  const saveEdit=()=>{if(!editText.trim())return;setNotes(n=>n.map(x=>x.id===editId?{...x,text:editText.trim(),edited:Date.now()}:x));setEditId(null);};
  return (
    <div className="p-4 space-y-4">
      <div className="pt-4"><h2 className="text-2xl font-black" style={{color:T.text}}>NOTES</h2><div className="text-xs mt-1" style={{color:T.sub}}>Goals, ideas, reminders.</div></div>
      <div className={C+' overflow-hidden'} style={s.card(T)}>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write a note..." rows={3}
          className="w-full bg-transparent px-4 pt-4 pb-2 text-sm outline-none resize-none" style={{color:T.text}}/>
        <div className="flex justify-between items-center px-4 pb-3">
          <span className="text-xs" style={{color:T.sub}}>{text.length>0?`${text.length} chars`:''}</span>
          <button onClick={add} disabled={!text.trim()} className="px-4 py-2 rounded-xl text-sm font-black text-white" style={{background:text.trim()?T.accent:T.inp,color:text.trim()?'#fff':T.sub}}>Save</button>
        </div>
      </div>
      {notes.length===0&&<div className="text-center py-10" style={{color:T.sub}}><FileText size={34} className="mx-auto mb-3 opacity-30"/><div className="text-sm">No notes yet.</div></div>}
      <div className="space-y-3">
        {notes.map(note=>(
          <div key={note.id} className={C+' overflow-hidden'} style={s.card(T)}>
            {editId===note.id?(
              <div>
                <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={4} autoFocus className="w-full bg-transparent px-4 pt-4 pb-2 text-sm outline-none resize-none" style={{color:T.text,borderBottom:`1px solid ${T.border}`}}/>
                <div className="flex gap-2 p-3">
                  <button onClick={()=>setEditId(null)} className="flex-1 py-2 rounded-xl text-sm font-bold" style={{background:T.inp,color:T.sub}}>Cancel</button>
                  <button onClick={saveEdit} className="flex-1 py-2 rounded-xl text-sm font-black text-white" style={{background:T.accent}}>Save</button>
                </div>
              </div>
            ):(
              <div className="p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3" style={{color:T.text}}>{note.text}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{color:T.sub}}>{fmtTime(note.edited||note.ts)}{note.edited?' (edited)':''}</span>
                  <div className="flex gap-2">
                    <button onClick={()=>{setEditId(note.id);setEditText(note.text);}} className="p-1.5 rounded-lg" style={{background:T.inp,color:T.sub}}><Edit2 size={12}/></button>
                    <button onClick={()=>del(note.id)} className="p-1.5 rounded-lg" style={{background:T.inp,color:'#f87171'}}><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab({workouts,T,exportCSV}) {
  const prs=getPRs(workouts);
  const streak=calcStreak(workouts);
  const totalVol=workouts.reduce((a,w)=>a+(w.exercises?.reduce((b,e)=>b+(e.sets*e.reps*e.weight),0)??0),0);
  const weeklyData=useMemo(()=>calcWeeklyData(workouts),[workouts]);
  const muscleBreak=useMemo(()=>{const m=calcMuscleSets(workouts);return Object.entries(m).map(([name,vol])=>({name,vol})).sort((a,b)=>b.vol-a.vol).slice(0,7);},[workouts]);
  const suggestDeload=weeklyData.slice(-4).filter(w=>w.vol>0).length>=4;
  const MILESTONES=[1,2,4,8,12,16,24,52];
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h2 className="text-2xl font-black" style={{color:T.text}}>STATS</h2>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{background:T.card,color:T.sub}}><Download size={12}/> CSV</button>
      </div>
      {suggestDeload&&(
        <div className="rounded-2xl p-4 border" style={{background:'rgba(234,179,8,0.1)',borderColor:'#eab308'}}>
          <div className="flex items-center gap-2 mb-1"><Zap size={13} style={{color:'#eab308'}}/><span className="text-sm font-black" style={{color:'#eab308'}}>DELOAD SUGGESTED</span></div>
          <div className="text-xs" style={{color:T.sub}}>4+ consecutive hard weeks. Consider reducing weight ~40% this week.</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[{icon:<Dumbbell size={14}/>,val:workouts.length,label:'Total Workouts'},{icon:<Flame size={14}/>,val:`${streak}w`,label:'Streak'},{icon:<Zap size={14}/>,val:fmt(totalVol),label:'Total Volume'},{icon:<Award size={14}/>,val:prs.length,label:'PRs Tracked'}].map((x,i)=>(
          <div key={i} className={C+' p-4'} style={s.card(T)}>
            <div style={{color:T.accent}} className="mb-1">{x.icon}</div>
            <div className="text-2xl font-black" style={{color:T.text}}>{x.val}</div>
            <div className="text-xs" style={{color:T.sub}}>{x.label}</div>
          </div>
        ))}
      </div>
      {/* Milestones */}
      <div className={C+' p-4'} style={s.card(T)}>
        <div className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2" style={{color:T.sub}}><Trophy size={12} style={{color:'#eab308'}}/> Milestones</div>
        <div className="flex flex-wrap gap-2">
          {MILESTONES.map(m=>(
            <div key={m} className="px-3 py-1.5 rounded-full text-xs font-black border" style={{borderColor:streak>=m?'#eab308':T.border,color:streak>=m?'#eab308':T.sub,background:streak>=m?'rgba(234,179,8,0.1)':'transparent'}}>
              {m}w {streak>=m?'✓':''}
            </div>
          ))}
        </div>
      </div>
      {weeklyData.length>0&&(
        <div className={C+' p-4'} style={s.card(T)}>
          <div className="text-xs uppercase tracking-widest mb-3" style={{color:T.sub}}>Weekly Volume</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={weeklyData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="week" tick={{fill:T.sub,fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.sub,fontSize:9}} axisLine={false} tickLine={false} width={28} tickFormatter={fmt}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:11}} formatter={v=>[`${fmt(v)} lbs`]}/>
              <Bar dataKey="vol" fill={T.accent} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {muscleBreak.length>0&&(
        <div className={C+' p-4'} style={s.card(T)}>
          <div className="text-xs uppercase tracking-widest mb-3" style={{color:T.sub}}>Volume by Muscle</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={muscleBreak} layout="vertical" barSize={11}>
              <XAxis type="number" tick={{fill:T.sub,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
              <YAxis type="category" dataKey="name" tick={{fill:T.text,fontSize:9}} axisLine={false} tickLine={false} width={65}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:11}} formatter={v=>[`${fmt(v)} lbs`]}/>
              <Bar dataKey="vol" fill="#a855f7" radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {prs.length>0&&(
        <div className={C+' overflow-hidden'} style={s.card(T)}>
          <div className="p-4 flex items-center gap-2" style={{borderBottom:`1px solid ${T.border}`}}><Award size={13} style={{color:'#eab308'}}/><span className="text-xs uppercase tracking-widest" style={{color:T.sub}}>Personal Records + 1RM</span></div>
          {prs.map((pr,i)=>(
            <div key={i} className="flex justify-between items-center px-4 py-3" style={{borderBottom:`1px solid ${T.border}`}}>
              <div><div className="text-sm font-bold" style={{color:T.text}}>{pr.exercise}</div><div className="text-xs" style={{color:T.sub}}>{pr.date} · Est. 1RM: <span style={{color:'#67e8f9'}}>{epley(pr.weight,pr.reps)}lbs</span></div></div>
              <div className="text-right"><div className="text-sm font-black" style={{color:'#eab308'}}>{pr.weight>0?`${pr.weight}lbs`:'BW'}</div><div className="text-xs" style={{color:T.sub}}>{pr.sets}×{pr.reps}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
