# Keeper Planner

Your training week on one screen: an hour-by-hour calendar built for training, a gym logger, and a progress page Claude reads every Sunday.

Live at **https://keeper-planner.vercel.app**. Every push to `main` deploys.

This replaces FitTracker v1. The old code sits in `legacy/fittracker-v1`, and your old workouts can be imported from Settings.

## What it does

**Calendar.** Day, 3-day, week and month views. Drag to create, move and resize. Presets for every session, a quick-add line (`thu 4pm legs`), copy and paste days, and fill whole weeks from your base template. Each day header shows how much got done, and blocks that ended without a log get a dashed outline and land in the To log list.

**Gym.** Your workouts as cards with a Start button, an empty workout for anything unplanned, and a simple builder: exercises, sets, reps, target weight. Starting a workout from anywhere (Gym, Library, Today, the calendar) opens the logger here. Focus mode walks you through one set at a time with weights carried over from last time and a rest timer; List mode shows everything. Swap an exercise when the machine is taken. New records call themselves out. History, lift charts, records and sets per muscle live here too.

**Plan.** Plyometrics and legs are separate sessions on Thursday. A short nightly flexibility routine runs most nights, and heavy flexibility happens Wednesday and Saturday. The key hip and posture work is folded into both.

**Progress.** This week's blocks logged, training and study hours, flexibility streak, planned vs done by week with study included, and month-to-date sleep and flexibility grids plus weight and recovery charts. Tap any day to open it.

**Coach.** Notes and goals for Claude, the weekly review, and an Ask Claude box.

**Looks.** Industrial (default), Whiteboard, Blackboard, Pitch, or Auto, each with an accent color.

On a wide screen, block details open beside the calendar instead of on top of it.

## On your phone

Open the site in Chrome and create your account. Then go to Settings and tap Turn on reminders. Last, open the Chrome menu and tap Add to Home screen.

## Development

No install. In the Claude desktop app the preview uses `.claude/launch.json`. Leave `js/config.js` empty to run in local mode with data kept in the browser. Backend: `supabase/schema.sql` and `supabase/functions/send-push`.
