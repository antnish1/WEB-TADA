-- WEB-TADA authentication/profile setup helper
-- Run after 001_deputation_foundation.sql and 002_seed_branches_engineers.sql.

create or replace function public.assign_web_tada_profile(
  p_email text,
  p_full_name text,
  p_role public.app_role,
  p_branch_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_branch_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'No Supabase Auth user found for email %', p_email;
  end if;

  if p_branch_code is not null then
    select id into v_branch_id
    from public.branches
    where upper(code) = upper(trim(p_branch_code))
       or upper(name) = upper(trim(p_branch_code))
    limit 1;

    if v_branch_id is null then
      raise exception 'No active branch found for %', p_branch_code;
    end if;
  end if;

  if p_role in ('branch_manager','engineer','accounts') and v_branch_id is null then
    raise exception 'A branch is required for role %', p_role;
  end if;

  insert into public.profiles (id, full_name, role, branch_id, is_active)
  values (v_user_id, trim(p_full_name), p_role, v_branch_id, true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      branch_id = excluded.branch_id,
      is_active = true;

  return v_user_id;
end;
$$;

revoke all on function public.assign_web_tada_profile(text,text,public.app_role,text) from public;
revoke all on function public.assign_web_tada_profile(text,text,public.app_role,text) from anon;
revoke all on function public.assign_web_tada_profile(text,text,public.app_role,text) from authenticated;
grant execute on function public.assign_web_tada_profile(text,text,public.app_role,text) to service_role;

-- Example: after creating a user in Authentication > Users, run this in SQL Editor:
-- select public.assign_web_tada_profile(
--   'manager@example.com',
--   'Jabalpur Branch Manager',
--   'branch_manager',
--   'JABALPUR BHL'
-- );
