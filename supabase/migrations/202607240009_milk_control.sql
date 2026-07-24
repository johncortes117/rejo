create table if not exists public.milk_control_sessions (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  date date not null,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.milk_control_records (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  session_id uuid not null references public.milk_control_sessions(id),
  animal_id uuid not null references public.animals(id),
  liters numeric not null check (liters >= 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

alter table public.milk_control_sessions enable row level security;
alter table public.milk_control_records enable row level security;
create policy "Members can manage milk control sessions" on public.milk_control_sessions for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage milk control records" on public.milk_control_records for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
