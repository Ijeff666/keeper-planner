# Keeper Planner

Your training week on one screen: an hour-by-hour calendar built for training, a workout logger, and a progress page Claude reads every Sunday.

This replaces FitTracker v1. The old code sits in `legacy/fittracker-v1`. Its best parts came over: one-set-at-a-time logging with big buttons, PRs and estimated 1RM, water, bodyweight, swaps, quick log and CSV export. Your old workouts can be imported from Settings.

## What it does

**Calendar.** Day, 3-day, week and month views. Drag to create, move and resize. Presets for every session, a quick-add line (`thu 4pm legs plyo`), copy and paste days, and fill whole weeks from your base template. Each day header shows how much got done. Past blocks you never logged get a dashed outline and land in the To log list.

**Tracking.** Every training and study block gets Done, Half or Skipped. The day sheet shows hours trained and studied against plan, plus sleep, energy, water and weight.

**Workouts.** Focus mode walks you through one set at a time, with weights carried over from last time and a rest timer that buzzes. List mode shows everything at once. Swap an exercise when the machine is taken, add one mid-session, or log an unplanned workout from Today. New PRs call themselves out.

**Progress.** Weekly adherence, training and study hours, week streak, hip reset streak, lift charts, PR board, sets per muscle this week, bodyweight and recovery trends. Tap a point to jump to that day.

**Coach.** Notes and goals for Claude, the weekly review, and an Ask Claude box.

**Looks.** Industrial (default), Whiteboard, Blackboard, Pitch, or Auto, each with an accent color.

On a wide screen, details and the workout logger open beside the calendar instead of on top of it.

## Run it locally

No install needed. In the Claude desktop app the preview uses `.claude/launch.json`. With `js/config.js` left empty, the app runs in local mode and keeps data in the browser.

## Deploy

1. Supabase: run `supabase/schema.sql`, deploy `supabase/functions/send-push` with JWT verification off, then add the `push_url` row the schema file describes. Put the project URL and anon key in `js/config.js`.
2. Vercel: import this repo. `vercel.json` handles the build, so no settings to change.
3. In Supabase Auth, set the Site URL to the Vercel address.
4. On your phone, open the site in Chrome, sign in, then Settings: Turn on reminders, and Chrome menu: Add to Home screen.
