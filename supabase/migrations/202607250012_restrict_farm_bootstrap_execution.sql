revoke all on function public.bootstrap_farm(uuid, text, text, text, timestamptz) from anon;
revoke execute on function public.bootstrap_farm(uuid, text, text, text, timestamptz) from public;
grant execute on function public.bootstrap_farm(uuid, text, text, text, timestamptz) to authenticated;
