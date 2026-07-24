create table if not exists public.herd_groups (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  name text not null,
  sort_order integer not null,
  is_default boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

alter table public.animals add column if not exists herd_group_id uuid references public.herd_groups(id);
alter table public.herd_groups enable row level security;
create policy "Members can manage herd groups" on public.herd_groups for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
