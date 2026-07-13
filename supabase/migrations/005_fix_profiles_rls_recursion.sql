-- Fix infinite recursion in profiles RLS policies.
-- Run after 004_admin_user_management.sql.

create or replace function public.is_web_tada_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

revoke all on function public.is_web_tada_admin() from public;
grant execute on function public.is_web_tada_admin() to authenticated;

drop policy if exists "admins read all profiles" on public.profiles;
drop policy if exists "admins update all profiles" on public.profiles;

create policy "admins read all profiles" on public.profiles
for select to authenticated
using (public.is_web_tada_admin());

create policy "admins update all profiles" on public.profiles
for update to authenticated
using (public.is_web_tada_admin())
with check (public.is_web_tada_admin());
