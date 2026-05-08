-- QAplanet Phase 4 migration
-- Integrations, team collaboration, monetization readiness, and execution dashboard.
-- Safe to run more than once. This migration does not drop existing tables or data.

create extension if not exists "pgcrypto";

-- Existing projects can belong to an organization.
alter table public.projects add column if not exists organization_id uuid;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_organization_id_fkey'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
    add constraint projects_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete set null;
  end if;
end $$;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('Owner', 'Admin', 'QA Lead', 'Tester', 'Reviewer', 'Viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('Owner', 'Admin', 'QA Lead', 'Tester', 'Reviewer', 'Viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('Owner', 'Admin', 'QA Lead', 'Tester', 'Reviewer', 'Viewer')),
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('Free', 'Pro', 'Team', 'Enterprise')),
  monthly_price numeric(10, 2) not null default 0,
  max_projects integer,
  max_documents integer,
  max_ai_generations integer,
  max_team_members integer,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'document_uploaded',
      'ai_analysis_run',
      'test_cases_generated',
      'automation_generated',
      'export_created',
      'package_generated'
    )
  ),
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_name text not null,
  framework text not null,
  source text not null default 'Manual JSON import',
  total_tests integer not null default 0,
  passed integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  duration_seconds integer not null default 0,
  executed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  raw_results jsonb not null default '{}'::jsonb
);

create table if not exists public.test_run_results (
  id uuid primary key default gen_random_uuid(),
  test_run_id uuid not null references public.test_runs(id) on delete cascade,
  test_case_id uuid references public.test_cases(id) on delete set null,
  test_case_ref text,
  title text not null,
  status text not null check (status in ('passed', 'failed', 'skipped')),
  duration_seconds integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

-- Useful indexes.
create index if not exists idx_projects_organization_id on public.projects(organization_id);
create index if not exists idx_organizations_owner_id on public.organizations(owner_id);
create index if not exists idx_organization_members_organization_id on public.organization_members(organization_id);
create index if not exists idx_organization_members_user_id on public.organization_members(user_id);
create index if not exists idx_project_members_project_id on public.project_members(project_id);
create index if not exists idx_project_members_user_id on public.project_members(user_id);
create index if not exists idx_invitations_organization_id on public.invitations(organization_id);
create index if not exists idx_invitations_email on public.invitations(email);
create index if not exists idx_subscriptions_organization_id on public.subscriptions(organization_id);
create index if not exists idx_usage_events_organization_id on public.usage_events(organization_id);
create index if not exists idx_usage_events_project_id on public.usage_events(project_id);
create index if not exists idx_usage_events_user_id on public.usage_events(user_id);
create index if not exists idx_test_runs_project_id on public.test_runs(project_id);
create index if not exists idx_test_runs_owner_id on public.test_runs(owner_id);
create index if not exists idx_test_run_results_test_run_id on public.test_run_results(test_run_id);
create index if not exists idx_test_run_results_test_case_ref on public.test_run_results(test_case_ref);

-- Seed monetization plan definitions.
insert into public.plans (name, monthly_price, max_projects, max_documents, max_ai_generations, max_team_members, features)
values
  ('Free', 0, 1, 5, 20, 1, '["Single project", "Core exports", "Local package downloads"]'::jsonb),
  ('Pro', 49, 5, 100, 500, 3, '["Advanced exports", "GitHub-ready packages", "More projects"]'::jsonb),
  ('Team', 149, null, null, 2000, 15, '["Team collaboration", "Review workflow", "Execution dashboard"]'::jsonb),
  ('Enterprise', 0, null, null, null, null, '["SSO ready", "Custom compliance", "Priority onboarding"]'::jsonb)
on conflict (name) do update set
  monthly_price = excluded.monthly_price,
  max_projects = excluded.max_projects,
  max_documents = excluded.max_documents,
  max_ai_generations = excluded.max_ai_generations,
  max_team_members = excluded.max_team_members,
  features = excluded.features,
  updated_at = now();

-- RLS.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.project_members enable row level security;
alter table public.invitations enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.test_runs enable row level security;
alter table public.test_run_results enable row level security;

-- Policy helper blocks. Supabase/Postgres has no "create policy if not exists",
-- so each block checks pg_policies before creating the policy.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname = 'organizations_member_access') then
    create policy "organizations_member_access" on public.organizations
    for all using (
      owner_id = auth.uid()
      or exists (
        select 1 from public.organization_members om
        where om.organization_id = organizations.id
          and om.user_id = auth.uid()
      )
    ) with check (owner_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_members' and policyname = 'organization_members_member_access') then
    create policy "organization_members_member_access" on public.organization_members
    for all using (
      user_id = auth.uid()
      or exists (
        select 1 from public.organizations o
        where o.id = organization_members.organization_id
          and o.owner_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.organizations o
        where o.id = organization_members.organization_id
          and o.owner_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_members' and policyname = 'project_members_member_access') then
    create policy "project_members_member_access" on public.project_members
    for all using (
      user_id = auth.uid()
      or exists (
        select 1 from public.projects p
        where p.id = project_members.project_id
          and p.owner_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.projects p
        where p.id = project_members.project_id
          and p.owner_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitations' and policyname = 'invitations_admin_access') then
    create policy "invitations_admin_access" on public.invitations
    for all using (
      exists (
        select 1 from public.organizations o
        where o.id = invitations.organization_id
          and o.owner_id = auth.uid()
      )
      or exists (
        select 1 from public.organization_members om
        where om.organization_id = invitations.organization_id
          and om.user_id = auth.uid()
          and om.role in ('Owner', 'Admin')
      )
    ) with check (
      exists (
        select 1 from public.organizations o
        where o.id = invitations.organization_id
          and o.owner_id = auth.uid()
      )
      or exists (
        select 1 from public.organization_members om
        where om.organization_id = invitations.organization_id
          and om.user_id = auth.uid()
          and om.role in ('Owner', 'Admin')
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'plans_read_all') then
    create policy "plans_read_all" on public.plans
    for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_owner_admin_read') then
    create policy "subscriptions_owner_admin_read" on public.subscriptions
    for select using (
      exists (
        select 1 from public.organizations o
        where o.id = subscriptions.organization_id
          and o.owner_id = auth.uid()
      )
      or exists (
        select 1 from public.organization_members om
        where om.organization_id = subscriptions.organization_id
          and om.user_id = auth.uid()
          and om.role in ('Owner', 'Admin')
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_events' and policyname = 'usage_events_member_access') then
    create policy "usage_events_member_access" on public.usage_events
    for all using (
      user_id = auth.uid()
      or exists (
        select 1 from public.organizations o
        where o.id = usage_events.organization_id
          and o.owner_id = auth.uid()
      )
      or exists (
        select 1 from public.organization_members om
        where om.organization_id = usage_events.organization_id
          and om.user_id = auth.uid()
      )
    ) with check (user_id = auth.uid() or user_id is null);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'test_runs' and policyname = 'test_runs_project_access') then
    create policy "test_runs_project_access" on public.test_runs
    for all using (
      owner_id = auth.uid()
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = test_runs.project_id
          and pm.user_id = auth.uid()
      )
    ) with check (
      owner_id = auth.uid()
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = test_runs.project_id
          and pm.user_id = auth.uid()
          and pm.role in ('Owner', 'Admin', 'QA Lead', 'Tester')
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'test_run_results' and policyname = 'test_run_results_project_access') then
    create policy "test_run_results_project_access" on public.test_run_results
    for all using (
      exists (
        select 1 from public.test_runs tr
        where tr.id = test_run_results.test_run_id
          and (
            tr.owner_id = auth.uid()
            or exists (
              select 1 from public.project_members pm
              where pm.project_id = tr.project_id
                and pm.user_id = auth.uid()
            )
          )
      )
    ) with check (
      exists (
        select 1 from public.test_runs tr
        where tr.id = test_run_results.test_run_id
          and (
            tr.owner_id = auth.uid()
            or exists (
              select 1 from public.project_members pm
              where pm.project_id = tr.project_id
                and pm.user_id = auth.uid()
                and pm.role in ('Owner', 'Admin', 'QA Lead', 'Tester')
            )
          )
      )
    );
  end if;
end $$;
