create table if not exists public.transactions (
  id uuid primary key, farm_id uuid not null references public.farms(id), date date not null,
  direction text not null check (direction in ('income', 'expense')), category text not null,
  amount numeric not null, description text, is_estimated boolean not null default false,
  created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz, synced_at timestamptz, created_by uuid not null
);
create table if not exists public.assets (
  id uuid primary key, farm_id uuid not null references public.farms(id), name text not null, category text not null,
  purchase_date date not null, purchase_value numeric not null, useful_life_years integer not null, salvage_value numeric not null,
  created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz, synced_at timestamptz, created_by uuid not null
);
create table if not exists public.labor (
  id uuid primary key, farm_id uuid not null references public.farms(id), worker_name text not null,
  type text not null check (type in ('daily', 'monthly', 'family')), rate numeric not null, days_worked numeric not null, period text not null,
  created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz, synced_at timestamptz, created_by uuid not null
);
alter table public.transactions enable row level security;
alter table public.assets enable row level security;
alter table public.labor enable row level security;
create policy "Members can manage transactions" on public.transactions for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage assets" on public.assets for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
create policy "Members can manage labor" on public.labor for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
