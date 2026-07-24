create table if not exists public.price_settings (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  effective_from date not null,
  support_price numeric not null,
  historical_floor numeric not null,
  fat_base numeric not null,
  fat_step numeric not null,
  fat_price_per_step numeric not null,
  protein_base numeric not null,
  protein_step numeric not null,
  protein_price_per_step numeric not null,
  ufc_base integer not null,
  ufc_step integer not null,
  ufc_price_per_step numeric not null,
  ccs_base integer not null,
  ccs_step integer not null,
  ccs_price_per_step numeric not null,
  brucellosis_free_bonus numeric not null,
  bpp_bonus numeric not null,
  source_document text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.milk_quality_tests (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  date date not null,
  fat_pct numeric,
  protein_pct numeric,
  ufc integer,
  ccs integer,
  lab_name text,
  source text not null check (source in ('buyer_reported', 'independent')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

create table if not exists public.settlements (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  buyer_id uuid not null references public.buyers(id),
  period_start date not null,
  period_end date not null,
  liters_paid numeric not null,
  price_per_liter_paid numeric not null,
  total_paid numeric not null,
  quality_test_id uuid references public.milk_quality_tests(id),
  reconciled boolean not null default false,
  variance_liters numeric,
  variance_amount numeric,
  legal_price_computed numeric,
  legal_variance_per_liter numeric,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

alter table public.price_settings enable row level security;
alter table public.milk_quality_tests enable row level security;
alter table public.settlements enable row level security;

create policy "Members can manage price settings" on public.price_settings for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage milk quality tests" on public.milk_quality_tests for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage settlements" on public.settlements for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
