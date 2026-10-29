// Starter plan, transcribed from the Google Calendar block that runs Wk1 Oct 28 → Wk4 deload ending Nov 24.
// Item kinds: reps (optionally with load), time, count (drills), check (one tap).
import { uid, rangeKeys, DOW, dow } from './util.js';

const check = (name, cue) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32), name, kind: 'check', cue: cue || '' });
const item = (id, name, kind, byWeek, extra = {}) => ({ id, name, kind, byWeek, ...extra });

export const SESSIONS = [
  {
    id: 'team-practice', title: 'Team Practice (GK)', cat: 'team', location: 'Team field', duration: 90,
    keywords: ['practice', 'team', 'training'],
    notes: 'Pick one thing to improve each session and write it in the session note afterward.',
    parts: [
      { name: 'Pre-practice warm-up (15 min)', items: [
        check('2 min easy jog or brisk walk'),
        check('Leg swings 10/side', 'Front-back and side-to-side'),
        check('Lateral lunges 8/side'),
        check('Glute bridges x10', 'Ribs down, squeeze 2 sec at the top'),
        check('Deep bodyweight squat x5', '3-sec pause at the bottom'),
        check('Shoulder circles + arm swings x10'),
        check('20 quick self-toss catches', 'Wake up your hands'),
      ] },
      { name: 'During practice', items: [
        check('Set position every rep', 'Feet shoulder-width, weight on the balls of your feet, hands up and out front'),
        check('Talk early and loud', 'Organize the back line, call every cross'),
        check('One thing to improve', 'Pick it before you start; note it after'),
      ] },
      { name: 'After (10 min)', items: [
        check('Easy walk 3 min'),
        check('Half-kneeling hip flexor stretch 45 sec/side', 'Tailbone tucked'),
        check('Hamstring stretch 30 sec/side'),
        check('Doorway chest/shoulder stretch 2x30 sec'),
        check('Meal with carbs + protein within an hour'),
      ] },
    ],
  },
  {
    id: 'flex-light', title: 'Nightly Flexibility', cat: 'recovery', location: 'Home', duration: 15, remind: 0,
    keywords: ['flexibility', 'flex', 'stretch', 'nightly', 'mobility', 'hip', 'posture'],
    notes: 'Light and easy before bed. Mild stretch only, never sharp pain. Skip it on heavy flexibility days.',
    parts: [
      { name: 'Ten minutes', items: [
        check('90/90 hip switches x8/side', 'Slow, drive the front knee toward the floor'),
        check('Half-kneeling hip flexor stretch 45 sec/side', 'Tailbone tucked, glute squeezed, ribs down, no low-back arch'),
        check('Quad stretch 30 sec/side', 'Tailbone tucked'),
        check('Glute bridge x12', 'Ribs down, 2-sec squeeze at the top'),
        check('Figure-4 glute stretch 30 sec/side'),
        check('Wall posture check 30 sec', 'Heels, glutes, upper back on the wall, feet parallel, ribs down'),
      ] },
    ],
  },
  {
    id: 'plyo', title: 'Plyometrics', cat: 'plyo', location: 'YMCA', duration: 30, remind: 25, remindNote: 'Leave by 3:50',
    keywords: ['plyometrics', 'plyo', 'plyos', 'jumps', 'jump', 'explosive'],
    notes: 'No box needed. Do it fresh, before legs. Gym floor, turf, or grass.',
    warmup: '5 min easy bike or incline walk · 90/90 hip switches 2x8 · glute bridges 2x12 · bodyweight squats x10 with a 3-sec pause · leg swings 10/side',
    parts: [
      { name: 'Jumps', rest: 75, note: 'Land softly: hips back, knees over toes, never caving in. Stop a set if landings get sloppy.', items: [
        item('broad-jump', 'Broad jump, stick the landing 2 sec', 'reps', ['3x5', '4x5', '4x5 max distance', '2x5']),
        item('skater', 'Lateral skater bounds', 'reps', ['3x6/side', '3x8/side', '4x8/side', '2x6/side'], { cue: 'Stick each landing, toes forward' }),
        item('pogo', 'Pogo hops', 'reps', ['3x15', '3x20', '3x20', '2x15'], { cue: 'Stiff ankles, quick ground contact' }),
        item('sl-hop', 'Single-leg forward hop & stick', 'reps', ['2x5/side', '3x5/side', '3x6/side', '2x5/side']),
      ] },
    ],
  },
  {
    id: 'legs', title: 'Legs', cat: 'gym', location: 'YMCA', duration: 60, remind: null,
    keywords: ['legs', 'lower', 'squat', 'leg day'],
    notes: 'Add weight only if every rep was clean and you stopped with 2+ reps left.',
    warmup: 'Two ramp-up sets on the first lift: about 50% x8, then 75% x4',
    parts: [
      { name: 'Lifts', rest: 105, note: 'Squat cue: ribs down over pelvis, brace, squeeze glutes at the top. Don’t arch your low back.', items: [
        item('squat', 'Back squat (or leg press)', 'reps', ['4x8', '4x6-8', '4x5', '3x6 light'], { load: true, muscle: 'Quads', alts: ['Leg press', 'Goblet squat', 'Hack squat', 'Safety-bar squat'] }),
        item('rdl', 'Romanian deadlift', 'reps', ['3x8', '3x8', '3x6-8', '2x8'], { load: true, muscle: 'Hamstrings', alts: ['DB Romanian deadlift', 'Trap-bar deadlift', 'Good morning', 'Back extension'] }),
        item('bss', 'Bulgarian split squat', 'reps', ['3x8/leg', '3x8/leg', '3x8/leg', '2x8/leg'], { load: true, muscle: 'Quads', cue: 'DBs, back foot on a bench', alts: ['Reverse lunge', 'Step-up', 'Split squat'] }),
        item('hip-thrust', 'Hip thrust', 'reps', ['3x10', '3x10', '3x8', '2x10'], { load: true, muscle: 'Glutes', alts: ['Glute bridge', 'Cable pull-through', 'Hip thrust machine'] }),
        item('leg-curl', 'Leg curl machine', 'reps', ['3x12', '3x12', '3x10', '2x12'], { load: true, muscle: 'Hamstrings', alts: ['Nordic curl (assisted)', 'Swiss-ball leg curl', 'Slider leg curl'] }),
        item('calf', 'Calf raise', 'reps', ['3x15', '3x15', '3x12', '2x15'], { load: true, muscle: 'Calves', alts: ['Seated calf raise', 'Single-leg DB calf raise', 'Leg-press calf raise'] }),
        item('copenhagen', 'Copenhagen plank', 'time', ['2x20 sec/side', '2x25 sec/side', '2x30 sec/side', '2x20 sec/side'], { muscle: 'Adductors', cue: 'Groin protection' }),
      ] },
    ],
    cooldown: 'Half-kneeling hip flexor stretch with glute squeeze 2x45 sec/side · quad stretch 30 sec/side · hamstring stretch 30 sec/side',
  },
  {
    id: 'gk-diving', title: 'GK Diving & Distribution', cat: 'gk', location: 'Grass (solo)', duration: 60,
    keywords: ['diving', 'dive', 'distribution', 'kicking', 'throws'],
    bring: '2–3 balls, 6 cones (use a goal if one is free). Soft grass only.',
    notes: 'Low-intensity diving. Heavy diving is Sunday with partners.',
    warmup: '3 min easy jog · shuffles, carioca · leg swings 10/side · arm circles x10 · glute bridges x10',
    parts: [
      { name: 'Block A · Diving technique (20 min)', rest: 40, note: 'Hands lead and get behind the ball. Land on your side (hip to shoulder), never on your chest or elbow. Walk 30–45 sec between sets.', items: [
        item('dive-prog', 'This week’s dive progression', 'count', [
          'Kneeling falls to a ball 2 ft away 3x6/side, then squat dives (ball 3 ft) 2x5/side',
          'Squat dives 3x6/side, then standing dives to a self-toss 2–3 yds away 3x5/side',
          'Standing dives to a self-toss 3–4 yds away 4x5/side. Back up and set within 2 sec.',
          'Same as Wk1: kneeling falls 3x6/side + squat dives 2x5/side',
        ]),
      ] },
      { name: 'Block B · Distribution (25 min)', note: 'Weak foot first. Use cones as targets.', items: [
        item('goal-kicks', 'Goal kicks / dead balls to a cone zone 35–40 yds out', 'count', ['10 each foot', '12 each foot', '15 each foot', '8 each foot']),
        item('punts', 'Punts or drop-kicks', 'count', ['6 each foot', '8 each foot', '10 each foot', '5 each foot']),
        item('overhand', 'Overhand throws to targets 25 yds out', 'count', ['10', '12', '12', '8']),
        item('sidearm', 'Sidearm / bowled throws through gates 12–15 yds', 'count', ['10', '12', '12', '8']),
        item('pressure-pass', 'Under-pressure pass', 'count', ['3x8/foot', '3x10/foot', '4x8/foot', '2x8/foot'], { cue: 'Roll it out, close 2 steps, first touch, pass through a 2-cone gate 10 yds away' }),
      ] },
    ],
    cooldown: 'Easy walk · hip flexor stretch 45 sec/side · shoulder stretch 30 sec/side · 10 slow breaths',
  },
  {
    id: 'back-bi-core', title: 'Back / Biceps / Core', cat: 'gym', location: 'YMCA', duration: 60, remind: 25, remindNote: 'Leave by 5:50',
    keywords: ['back', 'biceps', 'core', 'pull', 'arms'],
    notes: 'Upper body only so your legs are fresh for Saturday. Stop each set with 2–3 reps left.',
    warmup: '3 min rower or bike · face pulls or band pull-aparts 2x15 · scap pull-downs 2x10 · cat-cow x8',
    parts: [
      { name: 'Lifts', rest: 90, note: 'Rest 90 sec on rows and pulldowns, 60 sec on the rest.', items: [
        item('pulldown', 'Lat pulldown (or assisted pull-ups)', 'reps', ['4x10', '4x8-10', '4x8', '3x10'], { load: true, muscle: 'Back', alts: ['Assisted pull-up', 'Single-arm cable pulldown', 'Band-assisted chin-up'] }),
        item('cable-row', 'Seated cable row, neutral grip', 'reps', ['4x10', '4x10', '4x8', '3x10'], { load: true, muscle: 'Back', alts: ['Chest-supported row', 'Machine row', 'T-bar row'] }),
        item('db-row', 'One-arm DB row', 'reps', ['3x10/side', '3x10/side', '3x8/side', '2x10/side'], { load: true, muscle: 'Back', alts: ['Single-arm cable row', 'Seal row', 'Inverted row'] }),
        item('face-pull', 'Cable face pull, rope', 'reps', ['3x15', '3x15', '3x12', '2x15'], { load: true, muscle: 'Shoulders', cue: 'Shoulder health for diving', alts: ['Band pull-apart', 'Reverse pec deck', 'Prone Y-T-W'] }),
        item('curl', 'EZ-bar or DB curl', 'reps', ['3x10', '3x10', '3x8', '2x10'], { load: true, muscle: 'Biceps', alts: ['Cable curl', 'Preacher curl', 'Incline DB curl'] }),
        item('hammer', 'Hammer curl', 'reps', ['3x12', '3x12', '3x10', '2x12'], { load: true, muscle: 'Biceps', alts: ['Rope cable hammer curl', 'Cross-body hammer curl'] }),
      ] },
      { name: 'Core (10 min)', rest: 60, items: [
        item('deadbug', 'Dead bug', 'reps', ['3x8/side', '3x10/side', '3x12/side', '2x8/side'], { muscle: 'Core', cue: 'Low back flat, ribs down' }),
        item('plank', 'Plank', 'time', ['3x30 sec', '3x40 sec', '3x45 sec', '2x30 sec'], { muscle: 'Core', cue: 'Tailbone tucked, glutes squeezed' }),
        item('pallof', 'Pallof press', 'reps', ['3x10/side', '3x10/side', '3x12/side', '2x10/side'], { load: true, muscle: 'Core', cue: 'Cable, anti-rotation' }),
        item('side-plank', 'Side plank', 'time', ['2x25 sec/side', '2x30 sec/side', '2x35 sec/side', '2x20 sec/side'], { muscle: 'Core' }),
      ] },
    ],
    cooldown: 'Child’s pose with lat reach 45 sec · doorway chest stretch 30 sec x2 · easy walk before you drive home',
  },
  {
    id: 'chest-shoulders', title: 'Chest / Shoulders / Triceps', cat: 'gym', location: 'Home gym', duration: 60, remind: 15,
    keywords: ['chest', 'shoulders', 'triceps', 'push', 'bench', 'upper'],
    notes: '2 sec down, press fast. Stop each set with 2–3 reps left. Add 5 lb only if every rep was clean. No spotter or safeties? Use dumbbells for the bench press.',
    warmup: 'Band or light-DB external rotations 2x12/arm · scap push-ups 2x10 · push-ups 2x10 · bench ramp-up: bar x10, then ~60% x5',
    parts: [
      { name: 'Lifts', rest: 90, note: 'Rest 2 min on bench, 60–90 sec on the rest.', items: [
        item('bench', 'Flat bench press', 'reps', ['4x8', '4x6-8', '4x5-6', '3x6 at Wk1 weight'], { load: true, rest: 120, muscle: 'Chest', alts: ['DB bench press', 'Floor press', 'Push-ups, weighted'] }),
        item('incline-db', 'Incline DB press (30–45°)', 'reps', ['3x10', '3x10', '3x8', '2x10'], { load: true, muscle: 'Chest', alts: ['Incline barbell press', 'Feet-elevated push-up'] }),
        item('decline-db', 'Decline DB press', 'reps', ['3x10', '3x10', '3x10', '2x10'], { load: true, muscle: 'Chest', alts: ['Dips', 'DB fly'] }),
        item('db-press', 'Seated DB shoulder press', 'reps', ['3x10', '3x8-10', '3x8', '2x10'], { load: true, muscle: 'Shoulders', alts: ['Arnold press', 'Landmine press', 'Half-kneeling DB press'] }),
        item('lateral', 'DB lateral raise', 'reps', ['3x15', '3x15', '3x12 heavier', '2x15'], { load: true, muscle: 'Shoulders', alts: ['Cable lateral raise', 'Lean-away lateral raise'] }),
        item('oh-ext', 'Overhead DB triceps extension', 'reps', ['3x12', '3x12', '3x10', '2x12'], { load: true, muscle: 'Triceps', alts: ['Skull crushers', 'Band pushdown', 'Bench dips'] }),
        item('cg-pushup', 'Close-grip push-ups', 'reps', ['2x (max − 2)', '2x (max − 2)', '2x (max − 2)', '2x10'], { muscle: 'Triceps' }),
      ] },
      { name: 'GK hand + shoulder finish (5 min)', rest: 45, items: [
        item('wrist', 'Wrist curls + reverse wrist curls', 'reps', ['2x15', '2x15', '2x15', '2x15'], { load: true, muscle: 'Forearms' }),
        item('pushup-plus', 'Push-up plus', 'reps', ['2x12', '2x12', '2x12', '2x12'], { muscle: 'Shoulders', cue: 'Spread the shoulder blades at the top' }),
        item('squeeze', 'Towel or ball squeeze', 'time', ['3x20 sec', '3x20 sec', '3x20 sec', '3x20 sec'], { muscle: 'Forearms' }),
      ] },
    ],
    cooldown: 'Doorway chest stretch 2x30 sec · cross-body shoulder stretch 30 sec/side',
  },
  {
    id: 'gk-footwork', title: 'GK Footwork, Handling & Reactions', cat: 'gk', location: 'Grass (solo)', duration: 60,
    keywords: ['footwork', 'handling', 'reactions', 'hands', 'catching'],
    bring: '6–8 cones, 1–2 balls (use a goal if one is free).',
    warmup: '3 min easy jog · 2x10 yds each of side shuffle, carioca, high knees, backpedal · lateral lunges 8/side · leg swings 10/side',
    parts: [
      { name: 'Block A · Footwork (20 min)', note: 'Toes forward (a slight turn-out is fine, no splaying), knees over the 2nd toe, weight on the balls of your feet, hands up.', items: [
        item('shuffle-gates', 'Shuffle gates, 10 sec on / 30 sec off', 'count', ['6 reps', '8 reps', '10 reps', '5 reps'], { cue: '2 cones 5 yds apart, no crossed feet, touch each cone' }),
        item('split-step', 'Split-step & push 2 steps', 'count', ['3x6/side', '3x8/side', '4x8/side', '2x6/side'], { cue: 'Small hop, land balanced, push on your own call' }),
        item('drop-step', 'Drop-step & recover', 'count', ['3x6/side', '4x6/side', '4x6/side', '2x6/side'], { cue: 'Cone 5 yds away at 45°; sprint to it, backpedal to start' }),
        item('box-drill', 'Box drill, 45 sec rounds / 45 sec rest', 'count', ['3 rounds', '4 rounds', '5 rounds', '2 rounds'], { cue: '4-yd square: shuffle, backpedal, shuffle, forward' }),
      ] },
      { name: 'Block B · Handling (20 min)', note: 'Make a W with thumbs and index fingers behind the ball. Soft hands, watch it in.', items: [
        item('high-catch', 'Self-toss high catch (~6 ft)', 'count', ['3x10', '3x10', '3x12', '2x10']),
        item('drop-catch', 'Drop & catch before the 2nd bounce', 'count', ['3x10', '3x10', '3x12', '2x10']),
        item('low-scoop', 'Low scoop', 'count', ['3x8/side', '3x8/side', '3x10/side', '2x8/side'], { cue: 'Get behind the line, elbows tight' }),
        item('bounce', 'Ground-bounce rebound', 'count', ['3x8', '3x8', '3x10', '2x8']),
        item('jump-catch', 'Jump catch', 'count', ['3x6', '3x6', '4x6', '2x6'], { cue: 'Drive the knee, catch at the highest point, land on 2 feet' }),
        item('post-smother', 'Goal free? Roll to each post, shuffle across, smother', 'count', ['10 each side', '10 each side', '10 each side', '10 each side']),
      ] },
    ],
    cooldown: 'Easy walk · hip flexor stretch 45 sec/side, tailbone tucked · hamstring stretch 30 sec/side',
  },
  {
    id: 'pickup', title: 'Pickup Soccer', cat: 'game', location: '', duration: 120, remind: 45,
    keywords: ['pickup', 'game', 'match', 'soccer', 'scrimmage'],
    parts: [
      { name: 'Before (5 min, at the field)', items: [
        check('Easy jog 2 min'),
        check('Leg swings 10/side, lateral lunges 8/side'),
        check('Glute bridges x10'),
        check('Ankle hops x10'),
        check('10 quick catches'),
      ] },
      { name: 'Goals today', items: [
        check('Play in goal for at least part of it'),
        check('Talk loud and early'),
        check('Distribute with both feet'),
        check('One thing you did well + one to fix', 'Write both in the session note'),
      ] },
      { name: 'After', items: [
        check('Walk 5 min before you sit down'),
        check('Meal with carbs + protein within an hour'),
      ] },
    ],
  },
  {
    id: 'flex-heavy', title: 'Heavy Flexibility', cat: 'recovery', location: 'YMCA or home', duration: 45, remind: 15,
    keywords: ['heavy flexibility', 'recovery', 'flexibility', 'stretch', 'foam', 'mobility', 'posture'],
    notes: 'Twice a week. Goal: ease anterior pelvic tilt and toe-out by lengthening hip flexors and quads, waking up glutes and deep core, and training hip internal rotation. Mild stretch only. Never force your feet or knees straight.',
    parts: [
      { name: 'Easy movement (10 min)', items: [
        item('easy-cardio', 'Easy bike, swim, or brisk walk', 'time', ['1x10 min', '1x10 min', '1x10 min', '1x10 min'], { cue: 'You should be able to talk the whole time' }),
      ] },
      { name: 'Foam roll (45–60 sec each)', note: 'Skip directly on the knee.', items: [
        check('Quads'), check('Hip flexors (face down)'), check('Glutes'), check('Hamstrings'), check('Calves'), check('Lats and upper back'),
      ] },
      { name: 'Stretch, hold 45–60 sec/side', noteByWeek: ['2 rounds', '2 rounds', '3 rounds of hip flexor + 90/90, 2 of the rest', '3 rounds of hip flexor + 90/90, 2 of the rest'], items: [
        check('Half-kneeling hip flexor stretch', 'Tuck tailbone, squeeze glute, ribs down, no arching'),
        check('Quad stretch, tailbone tucked'),
        check('90/90 hip stretch', 'Rotate the front thigh inward'),
        check('Supine hamstring stretch with a strap'),
        check('Pigeon glute stretch'),
        check('Frog / adductor rock-backs x10 slow'),
        check('Thread-the-needle x8/side'),
        check('Child’s pose with lat reach'),
      ] },
      { name: 'Posture and hip work', rest: 45, items: [
        item('bridge', 'Glute bridge', 'reps', ['2x12', '2x12', 'Single-leg 3x8/side', 'Single-leg 2x8/side'], { cue: 'Ribs down, 2-sec squeeze at the top', muscle: 'Glutes' }),
        item('deadbug-flex', 'Dead bug', 'reps', ['2x8/side', '2x8/side', '2x10/side', '2x8/side'], { muscle: 'Core' }),
        item('shortfoot', 'Short-foot holds', 'time', ['5x10 sec/foot', '5x10 sec/foot', '5x10 sec/foot', '3x10 sec/foot'], { cue: 'Barefoot, lift your arch without curling your toes' }),
        item('wall', 'Wall posture check + 20 steps', 'time', ['2x30 sec', '2x30 sec', '3x30 sec', '2x30 sec'], { cue: 'Feet parallel, ribs down. Then 20 steps, feet forward, push off the big toe.' }),
      ] },
    ],
  },
  {
    id: 'shot-stopping', title: 'GK Shot-Stopping (Heavy)', cat: 'gk', location: 'Weekend field + partners', duration: 75, remind: 45,
    keywords: ['shot', 'stopping', 'shots', 'saves', 'heavy', 'partners'],
    bring: '3–4 balls, cones, phone for filming (ask a partner to film 5–10 clips for tonight’s film review).',
    notes: 'Tell partners: 70% power from set zones, not full power. Rest 45–60 sec between sets.',
    warmup: '3 min jog · leg swings, lateral lunges, A-skips, hip openers · glute bridges x10 · band or arm circles · 6 easy catches with a partner · 6 soft rolling dives each side',
    parts: [
      { name: 'Shot-stopping blocks', rest: 50, items: [
        item('ground-shots', 'Set position + ground shots from 12–18 yds', 'count', ['12/side', '15/side', '18/side', '8/side'], { cue: 'Set before the strike, body behind the ball, hold or parry to a safe side' }),
        item('mid-dives', 'Mid-height shots + diving to the corners', 'count', ['8 dives/side', '10 dives/side', '12 dives/side', '6 dives/side'], { cue: 'Hands first, parry away from danger, back up and set' }),
        item('high-balls', 'High balls from each wing', 'count', ['8/side', '10/side', '12/side', '6/side'], { cue: 'Catch at the highest point; punch if crowded' }),
        item('1v1', '1v1 from 25 yds', 'count', ['6 reps', '8 reps', '10 reps', '5 reps'], { cue: 'Close down, set before their touch, stay big, stay on your feet' }),
        item('rapid-fire', 'Rapid fire from 8 yds (Wk2–3 only)', 'count', ['—', '6 shots', '6 shots', '—'], { cue: 'Stay in set position, fast reactions' }),
      ] },
    ],
    cooldown: 'Easy walk · hip flexor, glute, hamstring, shoulder stretches 30–45 sec each · 10 slow breaths',
  },
  {
    id: 'film-recruiting', title: 'GK Film Review + D1 Recruiting', cat: 'film', location: 'Home', duration: 45, remind: 15,
    keywords: ['film', 'review', 'recruiting', 'd1', 'video', 'highlights'],
    parts: [
      { name: 'Every week', items: [
        check('Watch this morning’s clips', 'Note 3 things: set position, hand shape, recovery speed'),
        check('15 min of elite GK clips', 'Pick 1 thing to try next week'),
      ] },
      { name: 'This week’s recruiting task', items: [
        item('recruit-task', 'Recruiting task', 'check', [
          'Build a list of 30 D1 programs and note each one’s GK depth (keepers, class years, who graduates soon). Confirm your NCAA Eligibility Center registration.',
          'Build your highlight reel, 3–5 min: best saves first, then distribution and command of your area. Use game clips as well as training.',
          'Draft your coach email (grad year, team/club, height and measurables, highlight link, schedule, why this program). Find coach emails for your top 15 schools and add them to a tracker.',
          'Send 5–10 short, personalized emails. Log the date sent and plan a follow-up in 2 weeks.',
        ]),
      ] },
    ],
  },
];

export const LIFE_PRESETS = [
  { id: 'uni', title: 'Uni', cat: 'uni', dur: 450, keywords: ['uni', 'class', 'classes', 'school', 'lecture', 'college'] },
  { id: 'study', title: 'Study', cat: 'study', dur: 120, keywords: ['study', 'homework', 'hw', 'revise', 'revision', 'reading', 'exam'] },
  { id: 'breakfast', title: 'Breakfast', cat: 'meal', dur: 30, keywords: ['breakfast'] },
  { id: 'lunch', title: 'Lunch', cat: 'meal', dur: 45, keywords: ['lunch'] },
  { id: 'dinner', title: 'Dinner', cat: 'meal', dur: 45, keywords: ['dinner', 'supper'] },
  { id: 'snack', title: 'Snack', cat: 'meal', dur: 15, keywords: ['snack', 'meal', 'eat', 'food'] },
  { id: 'sleep', title: 'Wind down + sleep', cat: 'sleep', dur: 90, keywords: ['sleep', 'bed', 'lights'] },
  { id: 'nap', title: 'Nap', cat: 'sleep', dur: 30, keywords: ['nap'] },
  { id: 'travel', title: 'Travel', cat: 'life', dur: 30, keywords: ['travel', 'drive', 'commute', 'bus'] },
  { id: 'free', title: 'Free time', cat: 'life', dur: 60, keywords: ['free', 'chill', 'break'] },
];

const b = (start, end, title, cat, extra = {}) => ({ start, end, title, cat, ...extra });
const ses = (id) => SESSIONS.find((s) => s.id === id);
const sb = (start, end, id, extra = {}) => {
  const s = ses(id);
  return b(start, end, s.title, s.cat, { sessionId: id, location: s.location || '', remind: s.remind ?? 30, remindNote: s.remindNote || '', ...extra });
};

const weekdayMorning = [
  b('06:15', '06:45', 'Wake + breakfast', 'meal'),
  b('07:00', '14:30', 'Uni', 'uni'),
  b('14:30', '15:00', 'Travel + snack', 'life'),
];
const sleep = b('22:30', '24:00', 'Wind down + sleep', 'sleep');
const night = (at = '21:30') => [
  sb(at, `${at.slice(0, 3)}${String(+at.slice(3) + 15).padStart(2, '0')}`, 'flex-light', { remind: 0 }),
  sleep,
];
const practiceEvening = [
  b('17:30', '18:15', 'Dinner (carbs + protein)', 'meal', { note: 'About 2 hours before practice.' }),
  b('18:45', '19:30', 'Warm-up + travel to practice', 'team', { remind: 15, note: 'Pre-practice warm-up is in the Team Practice session.' }),
  sb('19:30', '21:00', 'team-practice', { remind: null }),
  b('21:15', '21:45', 'Post-practice meal', 'meal'),
];

export const BASE_WEEK = {
  id: 'base', name: 'Base week',
  days: {
    mon: [...weekdayMorning, b('15:00', '17:00', 'Study', 'study'), ...practiceEvening, ...night('22:00')],
    tue: [
      ...weekdayMorning,
      b('15:00', '16:00', 'Study', 'study'),
      sb('16:00', '17:00', 'chest-shoulders'),
      sb('17:30', '18:30', 'gk-footwork'),
      b('18:45', '19:30', 'Dinner', 'meal'),
      b('19:30', '21:00', 'Study', 'study'),
      ...night(),
    ],
    wed: [
      ...weekdayMorning,
      b('15:00', '16:00', 'Study', 'study'),
      sb('16:00', '16:45', 'flex-heavy', { note: 'Three hours before practice, so the stretching won’t dull your power.' }),
      ...practiceEvening,
      sleep,
    ],
    thu: [
      ...weekdayMorning,
      b('15:00', '15:45', 'Study', 'study'),
      sb('16:00', '16:30', 'plyo'),
      sb('16:30', '17:30', 'legs', { remind: null }),
      b('18:00', '18:45', 'Dinner', 'meal'),
      b('19:00', '21:00', 'Study', 'study'),
      ...night(),
    ],
    fri: [
      ...weekdayMorning,
      b('15:00', '15:45', 'Study', 'study'),
      sb('16:00', '17:00', 'gk-diving'),
      b('17:00', '17:45', 'Snack + rest', 'meal'),
      sb('18:00', '19:00', 'back-bi-core'),
      b('19:15', '20:00', 'Dinner', 'meal'),
      ...night(),
    ],
    sat: [
      b('07:30', '08:00', 'Wake + breakfast', 'meal'),
      sb('08:30', '10:30', 'pickup'),
      b('11:00', '11:45', 'Lunch (carbs + protein)', 'meal'),
      b('12:00', '14:00', 'Study', 'study'),
      sb('16:00', '16:45', 'flex-heavy'),
      b('18:00', '18:45', 'Dinner', 'meal'),
      sleep,
    ],
    sun: [
      b('08:00', '08:30', 'Wake + breakfast', 'meal'),
      sb('10:00', '11:15', 'shot-stopping'),
      b('11:30', '12:15', 'Lunch', 'meal'),
      b('13:00', '15:00', 'Study', 'study'),
      b('17:00', '17:45', 'Dinner', 'meal'),
      sb('18:00', '18:45', 'film-recruiting'),
      b('20:30', '20:45', 'Read Claude’s weekly review', 'life', { remind: 0, note: 'Coach tab. Reply with anything that felt off this week.' }),
      ...night(),
    ],
  },
};

export const PROGRAM = { id: 'block1', name: 'GK Block 1', start: '2026-10-28', weeks: 4, deload: [4], end: '2026-11-24',
  notes: 'Weeks run Wednesday to Tuesday. Wk4 is a deload: same movements, lighter.' };

export const SETTINGS = {
  tz: 'America/New_York', units: 'lb', weekStart: 1, gridStart: 6, gridEnd: 24, remindDefault: 30,
  activeProgram: 'block1', theme: 'industrial', accent: 'theme', waterGoal: 8,
};

export function blocksForDay(template, dateKey) {
  return (template?.days?.[DOW[dow(dateKey)]] || []).map((blk) => ({ ...blk, id: uid() }));
}

export function starterDocs({ from = PROGRAM.start, to = PROGRAM.end } = {}) {
  const docs = [];
  docs.push(['settings', 'main', { ...SETTINGS, lifePresets: LIFE_PRESETS, seededAt: new Date().toISOString() }]);
  docs.push(['programs', PROGRAM.id, PROGRAM]);
  for (const s of SESSIONS) docs.push(['sessions', s.id, s]);
  docs.push(['templates', BASE_WEEK.id, BASE_WEEK]);
  for (const k of rangeKeys(from, to)) docs.push(['days', k, { date: k, blocks: blocksForDay(BASE_WEEK, k), note: '', template: 'base' }]);
  docs.push(['inbox', 'main', { notes: [] }]);
  return docs;
}
