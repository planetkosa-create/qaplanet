-- QAplanet Supabase schema
-- Run this in the Supabase SQL editor before using the app.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  role text default 'QA Analyst',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  storage_path text,
  extracted_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.requirement_analysis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_document_id uuid references public.uploaded_documents(id) on delete set null,
  summary text,
  business_rules jsonb not null default '[]',
  user_stories jsonb not null default '[]',
  acceptance_criteria jsonb not null default '[]',
  risks jsonb not null default '[]',
  gaps jsonb not null default '[]',
  assumptions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_id uuid references public.requirement_analysis(id) on delete set null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  test_case_id text not null,
  name text not null,
  description text not null,
  preconditions text,
  steps jsonb not null default '[]',
  expected_result text not null,
  priority text not null check (priority in ('Critical', 'High', 'Medium', 'Low')),
  type text not null check (type in ('Functional', 'Negative', 'Edge', 'Validation', 'Security', 'Accessibility', 'Performance', 'Role-based', 'Integration', 'Regression')),
  requirement_reference text,
  automation_candidate boolean not null default false,
  automation_notes text,
  readiness text not null default 'Manual Only' check (readiness in ('Automatable', 'Needs API/Data', 'Manual Only')),
  status text not null default 'Draft' check (status in ('Draft', 'Approved', 'Rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, test_case_id)
);

create table if not exists public.automation_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  readiness text not null check (readiness in ('Automatable', 'Needs API/Data', 'Manual Only')),
  candidate boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_scripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  test_case_ids uuid[] not null default '{}',
  code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  export_type text not null check (export_type in ('markdown', 'csv', 'json', 'excel')),
  file_name text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists test_cases_set_updated_at on public.test_cases;
create trigger test_cases_set_updated_at
before update on public.test_cases
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.uploaded_documents enable row level security;
alter table public.requirement_analysis enable row level security;
alter table public.test_cases enable row level security;
alter table public.automation_assessments enable row level security;
alter table public.generated_scripts enable row level security;
alter table public.exports enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "projects_crud_own" on public.projects;
drop policy if exists "uploaded_documents_crud_own" on public.uploaded_documents;
drop policy if exists "requirement_analysis_crud_own" on public.requirement_analysis;
drop policy if exists "test_cases_crud_own" on public.test_cases;
drop policy if exists "automation_assessments_crud_own" on public.automation_assessments;
drop policy if exists "generated_scripts_crud_own" on public.generated_scripts;
drop policy if exists "exports_crud_own" on public.exports;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "projects_crud_own" on public.projects
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "uploaded_documents_crud_own" on public.uploaded_documents
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "requirement_analysis_crud_own" on public.requirement_analysis
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "test_cases_crud_own" on public.test_cases
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "automation_assessments_crud_own" on public.automation_assessments
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "generated_scripts_crud_own" on public.generated_scripts
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "exports_crud_own" on public.exports
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

insert into storage.buckets (id, name, public)
values ('requirement-documents', 'requirement-documents', false)
on conflict (id) do nothing;

drop policy if exists "requirement_documents_select_own" on storage.objects;
drop policy if exists "requirement_documents_insert_own" on storage.objects;
drop policy if exists "requirement_documents_update_own" on storage.objects;
drop policy if exists "requirement_documents_delete_own" on storage.objects;

create policy "requirement_documents_select_own" on storage.objects
for select using (
  bucket_id = 'requirement-documents'
  and owner = auth.uid()
);

create policy "requirement_documents_insert_own" on storage.objects
for insert with check (
  bucket_id = 'requirement-documents'
  and owner = auth.uid()
);

create policy "requirement_documents_update_own" on storage.objects
for update using (
  bucket_id = 'requirement-documents'
  and owner = auth.uid()
);

create policy "requirement_documents_delete_own" on storage.objects
for delete using (
  bucket_id = 'requirement-documents'
  and owner = auth.uid()
);

-- Phase 2 additions: traceable requirement sources, analysis items, richer test cases,
-- generated automation, exports, and compatibility columns.

create table if not exists public.requirement_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name text not null,
  source_type text not null check (source_type in ('Upload', 'Manual Paste')),
  file_type text not null,
  file_size bigint not null default 0,
  storage_path text,
  extracted_text text not null default '',
  processing_status text not null default 'Uploaded' check (processing_status in ('Uploaded', 'Extracted', 'Analysis Ready', 'Failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  requirement_source_id uuid references public.requirement_sources(id) on delete set null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('Business Rule', 'User Story', 'Acceptance Criteria', 'Risk', 'Gap', 'Assumption', 'Actor / Role', 'System / Integration', 'Data Requirement')),
  title text not null,
  description text not null,
  reference_code text not null,
  confidence_score numeric(4,3) not null default 0.75,
  created_at timestamptz not null default now()
);

alter table public.test_cases alter column project_id drop not null;
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'test_cases_type_check'
      and conrelid = 'public.test_cases'::regclass
  ) then
    alter table public.test_cases drop constraint test_cases_type_check;
  end if;
end $$;

alter table public.test_cases
add constraint test_cases_type_check
check (type in ('Functional', 'Negative', 'Edge', 'Validation', 'Security', 'Accessibility', 'Performance', 'Role-based', 'Integration', 'Regression'));
alter table public.test_cases add column if not exists title text;
alter table public.test_cases add column if not exists test_type text;
alter table public.test_cases add column if not exists automation_status text;
alter table public.test_cases add column if not exists approval_status text;
alter table public.test_cases add column if not exists readiness_confidence numeric(4,3);
alter table public.test_cases add column if not exists readiness_reason text;
alter table public.test_cases add column if not exists recommended_framework text;
alter table public.test_cases add column if not exists analysis_item_ids text[] not null default '{}';
alter table public.test_cases add column if not exists requirement_source_ids text[] not null default '{}';

alter table public.automation_assessments alter column project_id drop not null;
alter table public.automation_assessments alter column test_case_id drop not null;
alter table public.automation_assessments add column if not exists test_case_ref text;
alter table public.automation_assessments add column if not exists confidence_score numeric(4,3) not null default 0.75;
alter table public.automation_assessments add column if not exists reason text;
alter table public.automation_assessments add column if not exists recommended_framework text;

create table if not exists public.generated_automation (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  language text not null check (language in ('typescript', 'python', 'gherkin')),
  framework text not null default 'Playwright',
  test_case_ids text[] not null default '{}',
  code text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'generated_automation_language_check'
      and conrelid = 'public.generated_automation'::regclass
  ) then
    alter table public.generated_automation drop constraint generated_automation_language_check;
  end if;
end $$;

alter table public.generated_automation
add constraint generated_automation_language_check
check (language in ('typescript', 'python', 'gherkin'));
alter table public.generated_automation add column if not exists generation_type text;
alter table public.generated_automation add column if not exists linked_feature_file_name text;

alter table public.exports alter column project_id drop not null;
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'exports_export_type_check'
      and conrelid = 'public.exports'::regclass
  ) then
    alter table public.exports drop constraint exports_export_type_check;
  end if;
end $$;

alter table public.exports
add constraint exports_export_type_check
check (export_type in ('markdown', 'csv', 'json', 'excel'));
alter table public.exports add column if not exists export_scope text;
alter table public.exports add column if not exists export_format text;
alter table public.exports add column if not exists row_count integer not null default 0;

alter table public.requirement_sources enable row level security;
alter table public.analysis_items enable row level security;
alter table public.generated_automation enable row level security;

drop policy if exists "requirement_sources_crud_own" on public.requirement_sources;
drop policy if exists "analysis_items_crud_own" on public.analysis_items;
drop policy if exists "generated_automation_crud_own" on public.generated_automation;

create policy "requirement_sources_crud_own" on public.requirement_sources
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "analysis_items_crud_own" on public.analysis_items
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "generated_automation_crud_own" on public.generated_automation
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Phase 3 additions: project workspace metadata, review workflow fields,
-- updated status checks, and export history metadata for demo readiness.

alter table public.projects add column if not exists client_name text;
alter table public.projects add column if not exists application_name text;
alter table public.projects add column if not exists release_name text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'projects_status_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects drop constraint projects_status_check;
  end if;
end $$;

alter table public.projects
add constraint projects_status_check
check (status in ('active', 'archived'));

alter table public.test_cases add column if not exists review_notes text;
alter table public.test_cases add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.test_cases add column if not exists approved_at timestamptz;
alter table public.test_cases add column if not exists rejected_by uuid references auth.users(id) on delete set null;
alter table public.test_cases add column if not exists rejected_at timestamptz;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'test_cases_status_check'
      and conrelid = 'public.test_cases'::regclass
  ) then
    alter table public.test_cases drop constraint test_cases_status_check;
  end if;
end $$;

alter table public.test_cases
add constraint test_cases_status_check
check (status in ('Draft', 'In Review', 'Approved', 'Rejected', 'Needs Update'));

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'test_cases_approval_status_check'
      and conrelid = 'public.test_cases'::regclass
  ) then
    alter table public.test_cases drop constraint test_cases_approval_status_check;
  end if;
end $$;

alter table public.test_cases
add constraint test_cases_approval_status_check
check (
  approval_status is null
  or approval_status in ('Draft', 'In Review', 'Approved', 'Rejected', 'Needs Update')
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'exports_export_type_check'
      and conrelid = 'public.exports'::regclass
  ) then
    alter table public.exports drop constraint exports_export_type_check;
  end if;
end $$;

alter table public.exports
add constraint exports_export_type_check
check (export_type in ('markdown', 'csv', 'json', 'excel', 'zip'));

-- Phase 4 additions: integrations, collaboration, monetization readiness,
-- GitHub-ready package tracking, and execution dashboard foundations.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  features jsonb not null default '[]'::jsonb
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
  features = excluded.features;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.project_members enable row level security;
alter table public.invitations enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.test_runs enable row level security;
alter table public.test_run_results enable row level security;

drop policy if exists "organizations_member_access" on public.organizations;
drop policy if exists "organization_members_member_access" on public.organization_members;
drop policy if exists "project_members_member_access" on public.project_members;
drop policy if exists "invitations_admin_access" on public.invitations;
drop policy if exists "plans_read_all" on public.plans;
drop policy if exists "subscriptions_member_read" on public.subscriptions;
drop policy if exists "usage_events_member_access" on public.usage_events;
drop policy if exists "test_runs_project_access" on public.test_runs;
drop policy if exists "test_run_results_project_access" on public.test_run_results;

create policy "organizations_member_access" on public.organizations
for all using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
  )
) with check (owner_id = auth.uid());

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

create policy "plans_read_all" on public.plans
for select using (true);

create policy "subscriptions_member_read" on public.subscriptions
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

create policy "usage_events_member_access" on public.usage_events
for all using (
  user_id = auth.uid()
  or exists (
    select 1 from public.organizations o
    where o.id = usage_events.organization_id
      and o.owner_id = auth.uid()
  )
) with check (user_id = auth.uid() or user_id is null);

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

-- Extend core project workflow policies so future project members can read
-- and collaborate inside assigned projects while keeping owner isolation.
drop policy if exists "projects_crud_own" on public.projects;
drop policy if exists "requirement_sources_crud_own" on public.requirement_sources;
drop policy if exists "analysis_items_crud_own" on public.analysis_items;
drop policy if exists "test_cases_crud_own" on public.test_cases;
drop policy if exists "automation_assessments_crud_own" on public.automation_assessments;
drop policy if exists "generated_automation_crud_own" on public.generated_automation;
drop policy if exists "exports_crud_own" on public.exports;

create policy "projects_crud_own" on public.projects
for all using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
  )
) with check (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
      and pm.role in ('Owner', 'Admin')
  )
);

create policy "requirement_sources_crud_own" on public.requirement_sources
for all using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = requirement_sources.project_id
      and pm.user_id = auth.uid()
  )
) with check (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = requirement_sources.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('Owner', 'Admin', 'QA Lead', 'Tester')
  )
);

create policy "analysis_items_crud_own" on public.analysis_items
for all using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = analysis_items.project_id
      and pm.user_id = auth.uid()
  )
) with check (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = analysis_items.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('Owner', 'Admin', 'QA Lead', 'Tester')
  )
);

create policy "test_cases_crud_own" on public.test_cases
for all using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = test_cases.project_id
      and pm.user_id = auth.uid()
  )
) with check (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = test_cases.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('Owner', 'Admin', 'QA Lead', 'Tester', 'Reviewer')
  )
);

create policy "automation_assessments_crud_own" on public.automation_assessments
for all using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = automation_assessments.project_id
      and pm.user_id = auth.uid()
  )
) with check (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = automation_assessments.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('Owner', 'Admin', 'QA Lead', 'Tester')
  )
);

create policy "generated_automation_crud_own" on public.generated_automation
for all using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = generated_automation.project_id
      and pm.user_id = auth.uid()
  )
) with check (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = generated_automation.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('Owner', 'Admin', 'QA Lead', 'Tester')
  )
);

create policy "exports_crud_own" on public.exports
for all using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = exports.project_id
      and pm.user_id = auth.uid()
  )
) with check (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = exports.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('Owner', 'Admin', 'QA Lead', 'Tester')
  )
);
