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
  existing_farm public.farms;
  created_farm public.farms;
  has_membership boolean;
  is_demo_account boolean;
  is_demo_farm boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  is_demo_account := auth.email() = 'test@gmail.com';
  is_demo_farm := p_name = 'Finca La Esperanza — Demo';

  select * into existing_farm
  from public.farms
  where id = p_farm_id
  for update;

  if found then
    select exists (
      select 1
      from public.farm_members
      where farm_id = p_farm_id
        and user_id = auth.uid()
    ) into has_membership;

    if not has_membership and existing_farm.created_by <> auth.uid() and not (is_demo_account and is_demo_farm) then
      raise exception 'This account cannot access this farm.' using errcode = '42501';
    end if;

    update public.farms
    set
      name = p_name,
      owner_name = p_owner_name,
      timezone = coalesce(p_timezone, public.farms.timezone),
      created_by = case when is_demo_account and is_demo_farm then auth.uid() else public.farms.created_by end,
      updated_at = greatest(public.farms.updated_at, p_created_at)
    where id = p_farm_id
    returning * into created_farm;
  else
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
    returning * into created_farm;
  end if;

  insert into public.farm_members (farm_id, user_id, role)
  values (p_farm_id, auth.uid(), 'admin')
  on conflict (farm_id, user_id) do nothing;

  return created_farm;
end;
$$;

revoke execute on function public.bootstrap_farm(uuid, text, text, text, timestamptz) from public;
grant execute on function public.bootstrap_farm(uuid, text, text, text, timestamptz) to authenticated;
