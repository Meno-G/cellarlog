-- Alert rules a winemaker sets per vessel (density not dropping, temperature
-- out of range). The app checks them on the phone against the running ferment's
-- readings; this table only stores the rules, so they follow the user across
-- the phone and the website.

create type public.alert_kind as enum ('density_stall', 'temperature_range');

create table public.alert_rules (
  id         uuid primary key default gen_random_uuid(),
  tank_id    uuid not null references public.tanks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       public.alert_kind not null,
  enabled    boolean not null default true,
  -- density_stall: {hours, minDrop, dryBelow}; temperature_range: {minC, maxC}. Validated in the app.
  params     jsonb not null check (jsonb_typeof(params) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One rule of each kind per vessel.
  unique (tank_id, kind)
);

comment on table public.alert_rules is 'A winemaker-set alert rule for one vessel. Evaluated on the device.';

create index alert_rules_user_idx on public.alert_rules (user_id);

revoke all on table public.alert_rules from anon;
grant select, insert, update, delete on table public.alert_rules to authenticated;

alter table public.alert_rules enable row level security;

create policy "Users can read their own alert rules"
  on public.alert_rules for select to authenticated
  using ((select auth.uid()) = user_id);

-- A rule may only be attached to a tank the same user owns.
create policy "Users can create alert rules on their own tanks"
  on public.alert_rules for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.tanks t
      where t.id = tank_id and t.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own alert rules"
  on public.alert_rules for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.tanks t
      where t.id = tank_id and t.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own alert rules"
  on public.alert_rules for delete to authenticated
  using ((select auth.uid()) = user_id);
