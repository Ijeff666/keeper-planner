# Keeper Planner

Training calendar and workout tracker for a college goalkeeper. Static site (no build step), data in Supabase, deployed on Vercel. FitTracker v1 (React/Vite) is kept in `legacy/` for reference only.

- Live: https://keeper-planner.vercel.app (Vercel project `keeper-planner`). Every push to `main` on github.com/Ijeff666/keeper-planner deploys.
- Supabase project ref `axmkcejjymlizkhozfiq` (org "Ijeff666's Org"). Push function `send-push`, cron job `kp-push`.
- Scheduled task `keeper-weekly-review` runs the check-in below every Sunday at 8pm while the desktop app is open.

## The person

- Goalkeeper chasing D1 recruitment. Uni 7:00am to 2:30pm on weekdays. Team practice Mon and Wed 7:30 to 9:00pm. Phone is Android.
- Current block: GK Block 1, Wk1 starts Wed Oct 28 2026, four weeks, Wk4 is a deload, ends Nov 24.
- Times are America/New_York.

## Data model

One table, `public.docs (user_id, coll, id, data jsonb, updated_at, updated_by)`. RLS limits rows to their owner. Read and write it with SQL through the Supabase connector. When Claude writes, set `updated_by = 'claude'` (the `docs_stamp` trigger also sets `updated_at = now()` and marks any SQL write as Claude's). If the phone holds unsent edits to a doc Claude changed, the app merges them: fields and day blocks the phone changed keep the phone's version, everything else takes Claude's.

| coll | id | what's in `data` |
|---|---|---|
| settings | main | tz, units, weekStart, theme, accent, waterGoal, lifePresets |
| programs | block1 | name, start, weeks, deload[], end |
| sessions | slug | title, cat, location, duration, remind, warmup, cooldown, parts[{name, rest, note, items[{id, name, kind, byWeek[4], load, muscle, alts, cue}]}] |
| templates | base | days.{mon..sun}: blocks without ids |
| days | YYYY-MM-DD | note (instructions for the day), blocks[{id, title, cat, start 'HH:MM', end 'HH:MM', sessionId, location, remind (min or null), remindNote, note}] |
| logs | YYYY-MM-DD | wellness{sleep, energy, soreness, mood, pain, weight, water}, blocks.{blockId}: {status done/partial/skipped, rpe, note, startedAt, finishedAt, items.{itemId}: {name, muscle, swap, sets[{w, r, s, done}], q}, extra[] for added exercises} |
| checkins | YYYY-MM-DD | title, week, summary, wins[], flags[], changes[], questions[], reply (the user's answer) |
| inbox | main | notes[{id, text, at}]: things the user wants Claude to know |

Rules the app relies on:
- `end` may be `'24:00'`. Times are local strings. Never convert to UTC.
- `byWeek[i]` is the prescription for program week i+1. `'—'` means not this week.
- Tracked blocks are every training category plus `study`. Categories: team, gk, gym, plyo, recovery, game, film (training); uni, study, meal, sleep, life.
- Sessions: team-practice, flex-light (nightly, except heavy days), flex-heavy (Wed and Sat), plyo and legs (Thu, back to back), gk-diving, back-bi-core, chest-shoulders, gk-footwork, pickup, shot-stopping, film-recruiting. The flexibility streak counts nights with flex-light or flex-heavy done.
- Gym workouts are sessions with cat gym or plyo. Workouts built in the Gym tab use `rx` ('3x10') and an optional target `weight` instead of `byWeek`.
- Writing a `days` row rebuilds that day's reminders through a trigger. Keep block ids stable when editing so logs stay attached; if you move a block to another day, move its `logs` entry with it. `remind` is whole minutes.
- Blocks with `adhoc: true` were created by starting a workout from the Gym tab or Library. Deleting that workout removes the block too.

## Check-ins

"Check my training" or the Sunday 8pm scheduled review:
1. Read the last 7 to 14 days of `days` and `logs`, the latest `checkins` (and its `reply`), and `inbox`.
2. Look at adherence (status per tracked block), sleep, soreness, pain notes, RPE, top sets and PRs, study hours, water.
3. Write `checkins/<today>` with summary, wins, flags, changes, questions. Plain, direct voice.
4. If the plan should change, edit upcoming `days` or `sessions` and list every change in `changes`.
5. Tell the phone: `insert into notifications (user_id, kind, title, body, url) values (<uid>, 'message', 'Weekly review is up', '<one line>', './#coach');`

Useful queries:
```sql
select id, data from docs where coll = 'logs' and id >= to_char(now() at time zone 'America/New_York' - interval '14 days', 'YYYY-MM-DD') order by id;
select id, data->'note', jsonb_path_query_array(data->'blocks', '$[*].title') from docs where coll = 'days' and id between '2026-11-01' and '2026-11-07' order by id;
```

## Code

- `js/lib.js` Preact + htm from one pinned CDN file. `js/store.js` local-first sync over `docs`. `js/model.js` all reads and writes, tracking stats, lift history, FitTracker import.
- `js/calendar.js` grid, quick add, block editor, day sheet. `js/workout.js` block details, status buttons, to-log queue, and `WorkoutView`, the full-page logger (Focus and List). `js/gym.js` the Gym tab: workout library, builder, history, lifts, records, muscle volume. `js/views.js` Today, Progress (month-to-date grids and charts), Coach. `js/library.js` sessions and template editors.
- Starting a workout anywhere calls `actions.openWorkout(date, blockId)`; the in-progress workout is kept in localStorage `kp:active` and shown in the Gym tab, with a resume bar on other tabs.
- Themes live in `css/app.css` as token sets (`industrial` default, `whiteboard`, `blackboard`, `pitch`); `js/theme.js` applies them.
- Comments only where they explain why. No emoji in UI or logs. No em dashes in copy.
- Local test: `.claude/launch.json` runs a PowerShell static server on port 8787. Leave `js/config.js` empty to run in local mode.
- Push: `supabase/schema.sql` (tables, RLS, reminder trigger, pg_cron dispatcher) and `supabase/functions/send-push`.
