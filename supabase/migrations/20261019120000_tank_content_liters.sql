-- How much wine is in a vessel now (liters), next to its capacity (volume_liters).
-- Null = not recorded (every vessel made before this column existed).
alter table public.tanks
  add column content_liters numeric(10, 1) check (content_liters is null or content_liters >= 0);

comment on column public.tanks.content_liters is 'Liters of wine in the vessel now; volume_liters is its capacity. Null = not recorded.';
