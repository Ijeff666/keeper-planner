-- Keeper Planner database. Apply once to a fresh Supabase project.
-- Everything the app stores is a JSON document in `docs`, keyed by (user, collection, id), so Claude can read and
-- edit any of it with plain SQL. Collections: settings, programs, sessions, templates, days, logs, checkins, inbox.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.docs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coll text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (user_id, coll, id)
);
alter table public.docs enable row level security;
drop policy if exists "own docs" on public.docs;
create policy "own docs" on public.docs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Realtime needs the full old row so DELETE events can be filtered by user_id.
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  keys jsonb not null,
  ua text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own subscriptions" on public.push_subscriptions;
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'message')),
  day date,
  block_id text,
  title text not null,
  body text,
  url text,
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_due_idx on public.notifications (send_at) where sent_at is null and error is null;
create index if not exists notifications_user_idx on public.notifications (user_id);
alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
-- The app may only send itself messages (the Settings test button). Reminders come from the trigger below.
drop policy if exists "send self a message" on public.notifications;
create policy "send self a message" on public.notifications for insert to authenticated
  with check (user_id = (select auth.uid()) and kind = 'message');

-- RLS on and no policies: only the service role (the edge function) and SQL run by the owner can read these.
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (name, value)
  values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (name) do nothing;

-- Any write to a day (from the app or from Claude) rebuilds that day's pending reminders,
-- so moving or deleting a block can never leave a stale notification behind.
create or replace function public.sync_reminders() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  d date;
  tz text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if r.coll <> 'days' or r.id !~ '^\d{4}-\d{2}-\d{2}$' then return r; end if;
  d := r.id::date;
  delete from notifications where user_id = r.user_id and kind = 'reminder' and day = d and sent_at is null;
  if tg_op = 'DELETE' then return old; end if;

  select data->>'tz' into tz from docs where user_id = r.user_id and coll = 'settings' and id = 'main';
  tz := coalesce(nullif(tz, ''), 'America/New_York');

  insert into notifications (user_id, kind, day, block_id, title, body, url, send_at)
  select r.user_id, 'reminder', d, b->>'id',
    b->>'title' || case when (b->>'remind')::int = 0 then ' starts now' else ' in ' || (b->>'remind') || ' min' end,
    concat_ws(' · ', lower(to_char((b->>'start')::time, 'FMHH12:MI AM')), nullif(b->>'location', ''), nullif(b->>'remindNote', '')),
    './#day/' || r.id,
    ((d + (b->>'start')::time) at time zone tz) - make_interval(mins => (b->>'remind')::int)
  from jsonb_array_elements(coalesce(r.data->'blocks', '[]'::jsonb)) b
  where jsonb_typeof(b->'remind') = 'number'
    and ((d + (b->>'start')::time) at time zone tz) - make_interval(mins => (b->>'remind')::int) > now();
  return new;
end $$;

drop trigger if exists docs_sync_reminders on public.docs;
create trigger docs_sync_reminders after insert or update or delete on public.docs
  for each row execute function public.sync_reminders();

-- Runs every minute but only calls the edge function when something is actually due.
create or replace function public.dispatch_push() returns void
language plpgsql security definer set search_path = public as $$
declare
  fn_url text;
  secret text;
begin
  if not exists (select 1 from notifications where sent_at is null and error is null and send_at <= now()) then return; end if;
  select value into fn_url from app_secrets where name = 'push_url';
  select value into secret from app_secrets where name = 'cron_secret';
  if fn_url is null or secret is null then return; end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{"action":"send"}'::jsonb,
    timeout_milliseconds := 10000
  );
end $$;

-- SECURITY DEFINER functions are callable over the REST API by default; only pg_cron and the trigger should run these.
revoke execute on function public.dispatch_push() from public, anon, authenticated;
revoke execute on function public.sync_reminders() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('kp-push');
exception when others then null; end $$;
select cron.schedule('kp-push', '* * * * *', 'select public.dispatch_push()');

-- After deploying the edge function, point the dispatcher at it:
-- insert into public.app_secrets (name, value) values ('push_url', 'https://<project-ref>.supabase.co/functions/v1/send-push')
--   on conflict (name) do update set value = excluded.value;
