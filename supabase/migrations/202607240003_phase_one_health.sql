create table if not exists public.health_events (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid references public.animals(id),
  date date not null,
  type text not null,
  product_name text,
  active_ingredient text,
  milk_withdrawal_hours numeric,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

alter table public.health_events enable row level security;

create policy "Members can manage health events" on public.health_events
  for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
