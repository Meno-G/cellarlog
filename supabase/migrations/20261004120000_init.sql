-- CellarLog initial schema: tanks + entries, with Row Level Security.
-- Run once in the Supabase dashboard (SQL Editor -> New query -> paste -> Run),
-- or with the Supabase CLI: `supabase db push`.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.entry_type as enum (
  'addition',
  'temperature',
  'lab_analysis',
  'tasting',
  'transfer',
  'note'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.tanks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 100),
  volume_liters numeric(10, 1) not null check (volume_liters > 0),
  variety       text check (variety is null or char_length(variety) <= 100),
  vintage       integer check (vintage is null or vintage between 1900 and 2100),
  created_at    timestamptz not null default now()
);

comment on table public.tanks is 'A winery tank owned by one user.';

-- Tank names are unique per user, ignoring case and surrounding spaces,
-- so "Tank 12" from a voice note matches exactly one tank.
create unique index tanks_user_name_key on public.tanks (user_id, lower(btrim(name)));

create table public.entries (
  id         uuid primary key default gen_random_uuid(),
  tank_id    uuid not null references public.tanks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type       public.entry_type not null,
  raw_text   text not null check (char_length(raw_text) <= 5000),
  parsed     jsonb not null check (jsonb_typeof(parsed) = 'object'),
  created_at timestamptz not null default now()
);

comment on table public.entries is 'A cellar log entry. raw_text is the typed note or transcript; parsed is the user-confirmed structured result.';

-- Tank timeline: newest first.
create index entries_tank_created_idx on public.entries (tank_id, created_at desc);
create index entries_user_idx on public.entries (user_id);

-- ---------------------------------------------------------------------------
-- Privileges: only signed-in users may touch these tables (RLS narrows further).
-- ---------------------------------------------------------------------------

revoke all on table public.tanks, public.entries from anon;
grant select, insert, update, delete on table public.tanks, public.entries to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: users only see and change their own rows.
-- (select auth.uid()) is evaluated once per query instead of once per row.
-- ---------------------------------------------------------------------------

alter table public.tanks enable row level security;
alter table public.entries enable row level security;

create policy "Users can read their own tanks"
  on public.tanks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own tanks"
  on public.tanks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tanks"
  on public.tanks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tanks"
  on public.tanks for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own entries"
  on public.entries for select to authenticated
  using ((select auth.uid()) = user_id);

-- An entry may only be attached to a tank the same user owns.
create policy "Users can create entries on their own tanks"
  on public.entries for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.tanks t
      where t.id = tank_id and t.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own entries"
  on public.entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.tanks t
      where t.id = tank_id and t.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own entries"
  on public.entries for delete to authenticated
  using ((select auth.uid()) = user_id);
