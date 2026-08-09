create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'ar' check (locale in ('ar','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','SUSPENDED')),
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (id, organization_id)
);

create index organization_memberships_user_idx on public.organization_memberships(user_id, organization_id);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  scope text not null default 'ORGANIZATION' check (scope in ('PLATFORM','ORGANIZATION')),
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.users(id),
  assigned_at timestamptz not null default now(),
  unique (membership_id, role_id),
  foreign key (membership_id, organization_id)
    references public.organization_memberships(id, organization_id)
    on delete cascade
);

create index user_roles_membership_idx on public.user_roles(membership_id, role_id);
create index user_roles_org_idx on public.user_roles(organization_id);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name_ar text not null,
  name_en text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);

create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_code text not null,
  title_ar text not null,
  title_en text,
  activity_type text,
  department_id uuid,
  planned_start_date date,
  planned_end_date date,
  delivery_method text,
  reporting_year integer not null check (reporting_year between 2000 and 2200),
  internal_state text not null default 'CREATED' check (
    internal_state in (
      'CREATED','PLANNING_DRAFT','PRE_REVIEW','READY_FOR_COMMITTEE',
      'UNDER_COMMITTEE_REVIEW','RETURNED_FOR_CORRECTION','NOT_APPROVED',
      'APPROVED_FOR_SCFHS_SUBMISSION','READY_FOR_SCFHS_SUBMISSION',
      'EXTERNAL_TRACKING','ACTIVITY_CONDUCTED','IMPACT_FOLLOWUP',
      'FINAL_IMPACT_REPORT','ANNUAL_REPORTING','ARCHIVED'
    )
  ),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, activity_code),
  unique (id, organization_id),
  foreign key (department_id, organization_id)
    references public.departments(id, organization_id)
);

create index activities_org_state_idx on public.activities(organization_id, internal_state);
create index activities_org_year_idx on public.activities(organization_id, reporting_year);

create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

create table public.activity_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  membership_id uuid not null,
  assignment_role text not null default 'ACTIVITY_OFFICER' check (assignment_role in ('ACTIVITY_OFFICER')),
  is_active boolean not null default true,
  assigned_by uuid not null references public.users(id),
  assigned_at timestamptz not null default now(),
  unique (activity_id, membership_id, assignment_role),
  foreign key (activity_id, organization_id)
    references public.activities(id, organization_id)
    on delete cascade,
  foreign key (membership_id, organization_id)
    references public.organization_memberships(id, organization_id)
    on delete cascade
);

create index activity_assignments_member_idx on public.activity_assignments(membership_id, is_active);
create index activity_assignments_activity_idx on public.activity_assignments(activity_id, is_active);

create table public.activity_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  from_state text,
  to_state text not null,
  changed_by uuid not null references public.users(id),
  role_context text not null,
  reason text,
  changed_at timestamptz not null default now(),
  foreign key (activity_id, organization_id)
    references public.activities(id, organization_id)
    on delete cascade
);

create index activity_status_history_activity_idx on public.activity_status_history(activity_id, changed_at desc);
