create table if not exists public.paddocks (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  name text not null,
  use text not null check (use in ('pasture', 'potato', 'rest', 'other')),
  area_hectares numeric,
  infrastructure text,
  target_rest_days integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.grazing_lots (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  name text not null,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.grazing_records (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  paddock_id uuid not null references public.paddocks(id),
  lot_id uuid not null references public.grazing_lots(id),
  entered_at date not null,
  exited_at date,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

alter table public.paddocks enable row level security;
alter table public.grazing_lots enable row level security;
alter table public.grazing_records enable row level security;
create policy "Members can manage paddocks" on public.paddocks for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage grazing lots" on public.grazing_lots for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage grazing records" on public.grazing_records for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
