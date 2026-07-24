alter table public.animals add column if not exists mother_id uuid references public.animals(id);

create table if not exists public.health_plan_tasks (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid references public.animals(id),
  category text,
  task_type text not null check (task_type in ('brucellosis_vaccination', 'deworming', 'annual_brucellosis_test')),
  due_date date not null,
  completed_at timestamptz,
  ignored_at timestamptz,
  recurrence_days integer,
  is_template boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz,
  created_by uuid not null
);

alter table public.health_plan_tasks enable row level security;

create policy "Members can manage health plan tasks" on public.health_plan_tasks
  for all using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
