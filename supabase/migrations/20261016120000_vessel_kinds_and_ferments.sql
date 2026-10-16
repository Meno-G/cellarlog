-- Vessel kinds (tank / qvevri / barrel), ferments, and a "decision" entry type.
--
-- A ferment is a vessel plus a start date and an optional end date. The entries
-- recorded on that vessel between those dates belong to it (no link column), so
-- old entries fall into past ferments as soon as a ferment is added for them.

-- A person's decision ("re-tested", "cooled"), kept apart from measurements.
alter type public.entry_type add value if not exists 'decision';

create type public.vessel_kind as enum ('tank', 'qvevri', 'barrel');

alter table public.tanks
  add column kind public.vessel_kind not null default 'tank';

create table public.ferments (
  id         uuid primary key default gen_random_uuid(),
  tank_id    uuid not null references public.tanks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 100),
  started_at timestamptz not null,
  ended_at   timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);

comment on table public.ferments is 'A fermentation in one vessel, from started_at to ended_at (null = still running). Entries in that window belong to it.';

create index ferments_tank_started_idx on public.ferments (tank_id, started_at desc);
create index ferments_user_idx on public.ferments (user_id);

revoke all on table public.ferments from anon;
grant select, insert, update, delete on table public.ferments to authenticated;

alter table public.ferments enable row level security;

create policy "Users can read their own ferments"
  on public.ferments for select to authenticated
  using ((select auth.uid()) = user_id);

-- A ferment may only be attached to a tank the same user owns.
create policy "Users can create ferments on their own tanks"
  on public.ferments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.tanks t
      where t.id = tank_id and t.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own ferments"
  on public.ferments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.tanks t
      where t.id = tank_id and t.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own ferments"
  on public.ferments for delete to authenticated
  using ((select auth.uid()) = user_id);
