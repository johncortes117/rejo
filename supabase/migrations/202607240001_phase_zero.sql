create extension if not exists pgcrypto;

create table if not exists public.farms (
  id uuid primary key,
  farm_id uuid not null unique,
  name text not null,
  owner_name text,
  province text,
  canton text,
  sector text,
  hectares numeric,
  altitude_m numeric,
  timezone text not null default 'America/Guayaquil',
  brucellosis_free boolean not null default false,
  bpp_certified boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.farm_members (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('admin', 'owner', 'worker', 'advisor')),
  created_at timestamptz not null default now(),
  unique (farm_id, user_id)
);

create or replace function public.is_farm_member(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.bootstrap_farm(
  p_farm_id uuid,
  p_name text,
  p_owner_name text,
  p_timezone text,
  p_created_at timestamptz
)
returns public.farms
language plpgsql
security definer
set search_path = public
as $$
declare
  created_farm public.farms;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  insert into public.farms (
    id,
    farm_id,
    name,
    owner_name,
    timezone,
    brucellosis_free,
    bpp_certified,
    created_at,
    updated_at,
    created_by
  )
  values (
    p_farm_id,
    p_farm_id,
    p_name,
    p_owner_name,
    coalesce(p_timezone, 'America/Guayaquil'),
    false,
    false,
    p_created_at,
    p_created_at,
    auth.uid()
  )
  on conflict (id) do update
    set name = excluded.name,
        owner_name = excluded.owner_name,
        updated_at = excluded.updated_at
  returning * into created_farm;

  insert into public.farm_members (farm_id, user_id, role)
  values (p_farm_id, auth.uid(), 'admin')
  on conflict (farm_id, user_id) do nothing;

  return created_farm;
end;
$$;

grant execute on function public.bootstrap_farm(uuid, text, text, text, timestamptz) to authenticated;

create table if not exists public.buyers (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  name text not null,
  type text not null,
  contact text,
  payment_frequency text,
  agreed_price_per_liter numeric,
  pays_quality_bonus boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.tank_calibrations (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  mark numeric not null,
  liters numeric not null,
  unit_label text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.animals (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  name text not null,
  sex text,
  birth_date date,
  birth_date_estimated boolean not null default true,
  photo_url text,
  status text not null default 'active',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.tank_readings (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  date date not null,
  time time not null,
  moment text not null,
  mark numeric,
  liters numeric not null,
  read_by text not null,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.milk_usages (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  date date not null,
  type text not null,
  liters numeric not null,
  animal_id uuid,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.buyers enable row level security;
alter table public.tank_calibrations enable row level security;
alter table public.animals enable row level security;
alter table public.tank_readings enable row level security;
alter table public.milk_usages enable row level security;

create policy "Members can read farms" on public.farms
  for select using (public.is_farm_member(id));
create policy "Members can update farms" on public.farms
  for update using (public.is_farm_member(id)) with check (public.is_farm_member(id));
create policy "Members can read farm members" on public.farm_members
  for select using (public.is_farm_member(farm_id));

create policy "Members can manage buyers" on public.buyers
  for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage tank calibrations" on public.tank_calibrations
  for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage animals" on public.animals
  for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage tank readings" on public.tank_readings
  for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage milk usages" on public.milk_usages
  for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
