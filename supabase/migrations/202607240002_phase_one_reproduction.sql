create table if not exists public.heats (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid not null references public.animals(id),
  date date not null,
  detected_by text,
  detected_where text,
  signs text,
  served boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.services (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid not null references public.animals(id),
  date date not null,
  type text not null check (type in ('natural', 'ai')),
  bull_id uuid references public.animals(id),
  straw_code text,
  straw_bull_name text,
  technician text,
  cost numeric,
  service_number integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.pregnancy_checks (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid not null references public.animals(id),
  date date not null,
  method text not null check (method in ('palpation', 'ultrasound', 'blood')),
  result text not null check (result in ('pregnant', 'open', 'doubtful')),
  estimated_days integer,
  technician text,
  cost numeric,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.calvings (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid not null references public.animals(id),
  date date not null,
  type text not null check (type in ('normal', 'assisted', 'cesarean')),
  outcome text not null check (outcome in ('live', 'stillborn', 'abortion', 'twins')),
  calf_ids uuid[] not null default '{}',
  complications text,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.dry_offs (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid not null references public.animals(id),
  date date not null,
  planned_date date,
  treatment_applied text,
  expected_calving_date date,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

alter table public.heats enable row level security;
alter table public.services enable row level security;
alter table public.pregnancy_checks enable row level security;
alter table public.calvings enable row level security;
alter table public.dry_offs enable row level security;

create policy "Members can manage heats" on public.heats for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage services" on public.services for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage pregnancy checks" on public.pregnancy_checks for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage calvings" on public.calvings for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage dry offs" on public.dry_offs for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
