alter table public.animals
  add column if not exists previous_calving_count integer;

alter table public.animals
  drop constraint if exists animals_previous_calving_count_nonnegative;

alter table public.animals
  add constraint animals_previous_calving_count_nonnegative
  check (previous_calving_count is null or previous_calving_count >= 0);
