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

-- The server stamps every write, so the app can tell when a doc it is editing was changed by Claude in the meantime.
-- Writes that don't come from a signed-in app session (SQL from Claude, the dashboard) count as Claude's.
create or replace function public.docs_stamp() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if (select auth.uid()) is null and coalesce(new.updated_by, 'app') = 'app' then new.updated_by := 'claude'; end if;
  return new;
end $$;
drop trigger if exists docs_stamp on public.docs;
create trigger docs_stamp before insert or update on public.docs for each row execute function public.docs_stamp();

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

-- A phone can move from one account to another. Holding the endpoint and its keys proves control of the device,
-- so the signed-in account takes the row over (RLS alone would block updating a row another account owns).
create or replace function public.claim_push_subscription(p_endpoint text, p_keys jsonb, p_ua text) returns void
language sql security definer set search_path = public as $$
  insert into push_subscriptions (endpoint, user_id, keys, ua)
  select p_endpoint, auth.uid(), p_keys, p_ua where auth.uid() is not null
  on conflict (endpoint) do update set user_id = excluded.user_id, keys = excluded.keys, ua = excluded.ua, created_at = now();
$$;
revoke execute on function public.claim_push_subscription(text, jsonb, text) from public, anon;
grant execute on function public.claim_push_subscription(text, jsonb, text) to authenticated;

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
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications add column if not exists claimed_at timestamptz;
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
  if tg_op = 'DELETE' then
    delete from notifications where user_id = r.user_id and kind = 'reminder' and day = d and sent_at is null;
    return old;
  end if;
  -- A bad block (odd time, a fractional reminder) must never stop the plan itself from saving.
  begin
    select data->>'tz' into tz from docs where user_id = r.user_id and coll = 'settings' and id = 'main';
    tz := coalesce(nullif(tz, ''), 'America/New_York');

    -- Future reminders are rebuilt. One that is already due but not yet sent stays if its block still fires at that
    -- moment: the rebuild only adds future ones, so a save in the minute before dispatch would otherwise drop it.
    with due as (
      select b->>'id' as block_id,
        b->>'title' || case when round((b->>'remind')::numeric) = 0 then ' starts now' else ' in ' || round((b->>'remind')::numeric) || ' min' end as title,
        concat_ws(' · ', lower(to_char((b->>'start')::time, 'FMHH12:MI AM')), nullif(b->>'location', ''), nullif(b->>'remindNote', '')) as body,
        ((d + (b->>'start')::time) at time zone tz) - make_interval(mins => round((b->>'remind')::numeric)::int) as at
      from jsonb_array_elements(coalesce(r.data->'blocks', '[]'::jsonb)) b
      where jsonb_typeof(b->'remind') = 'number' and (b->>'start') ~ '^([01]\d|2[0-4]):[0-5]\d$'
    ), cleared as (
      delete from notifications n
      where n.user_id = r.user_id and n.kind = 'reminder' and n.day = d and n.sent_at is null
        and (n.send_at > now() or not exists (select 1 from due x where x.block_id = n.block_id and x.at = n.send_at))
    )
    insert into notifications (user_id, kind, day, block_id, title, body, url, send_at)
    select r.user_id, 'reminder', d, x.block_id, x.title, x.body, './#day/' || r.id, x.at from due x where x.at > now();
  exception when others then
    raise warning 'sync_reminders skipped % for %: %', r.id, r.user_id, sqlerrm;
  end;
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
  if not exists (select 1 from notifications where sent_at is null and send_at <= now()
    and (error is null or (error = 'sending' and claimed_at < now() - interval '5 minutes'))) then return; end if;
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
