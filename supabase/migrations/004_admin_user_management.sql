alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists mobile_number text;
alter table public.profiles add column if not exists employee_code text;

create policy "admins read all profiles" on public.profiles
for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admins update all profiles" on public.profiles
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.is_web_tada_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

grant execute on function public.is_web_tada_admin() to authenticated;
