alter table public.animals
  add column if not exists photo_crop jsonb;
