create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','head_office','service_manager','branch_manager','engineer','accounts');
create type public.daily_status as enum ('not_filled','onsite','workshop','leave','absent','weekly_off','training','meeting','free','other');
create type public.deputation_status as enum ('draft','assigned','accepted','journey_started','reached_site','work_started','work_completed','cancelled');

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null,
  branch_id uuid references public.branches(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.engineers (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique,
  full_name text not null,
  home_branch_id uuid not null references public.branches(id),
  user_id uuid unique references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.daily_engineer_plans (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  branch_id uuid not null references public.branches(id),
  engineer_id uuid not null references public.engineers(id),
  status public.daily_status not null default 'not_filled',
  remarks text,
  finalized_at timestamptz,
  finalized_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_date, engineer_id)
);

create table public.deputations (
  id uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null references public.daily_engineer_plans(id) on delete cascade,
  sequence_number integer not null default 1,
  work_type text not null check (work_type in ('Onsite','Workshop')),
  call_type text,
  engineer_role text check (engineer_role in ('Primary Engineer','Secondary Engineer')),
  complaint text,
  customer_name text,
  contact_number text,
  machine_number text,
  hmr numeric,
  breakdown_status text,
  machine_model text,
  installation_date date,
  site_location text,
  deputation_time time,
  expected_completion_time time,
  call_id text,
  labour_charge numeric(12,2),
  expected_distance_km numeric(10,2),
  status public.deputation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(daily_plan_id, sequence_number)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  acted_by uuid references public.profiles(id),
  acted_at timestamptz not null default now()
);

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.engineers enable row level security;
alter table public.daily_engineer_plans enable row level security;
alter table public.deputations enable row level security;
alter table public.audit_logs enable row level security;

create policy "authenticated users read branches" on public.branches for select to authenticated using (true);
create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());

create policy "managers read branch engineers" on public.engineers for select to authenticated using (
  home_branch_id = (select branch_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','head_office','service_manager'))
);

create policy "managers manage branch plans" on public.daily_engineer_plans for all to authenticated using (
  branch_id = (select branch_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','head_office','service_manager'))
) with check (
  branch_id = (select branch_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','head_office','service_manager'))
);

create policy "users manage allowed deputations" on public.deputations for all to authenticated using (
  exists (
    select 1 from public.daily_engineer_plans p
    where p.id = daily_plan_id
      and (
        p.branch_id = (select branch_id from public.profiles where id = auth.uid())
        or p.engineer_id = (select id from public.engineers where user_id = auth.uid())
        or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','head_office','service_manager'))
      )
  )
) with check (
  exists (
    select 1 from public.daily_engineer_plans p
    where p.id = daily_plan_id
      and (
        p.branch_id = (select branch_id from public.profiles where id = auth.uid())
        or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','head_office','service_manager'))
      )
  )
);
