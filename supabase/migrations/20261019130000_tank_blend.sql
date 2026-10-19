-- A blended vessel: the parts of the wine in it, as a list of
-- {variety, vintage, liters}. Null = one wine (variety and vintage say which).
-- For a blend, variety holds the grapes joined by " + " and vintage the shared
-- year (null when the parts differ).
alter table public.tanks
  add column blend jsonb check (blend is null or jsonb_typeof(blend) = 'array');

comment on column public.tanks.blend is 'Parts of a blend: [{variety, vintage, liters}]. Null = one wine, as in variety / vintage.';
