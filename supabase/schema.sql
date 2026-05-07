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
  type text not null check (type in ('Functional', 'Negative', 'Edge', 'Validation', 'Role-based', 'Integration', 'Regression')),
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
  export_type text not null check (export_type in ('markdown', 'csv', 'excel')),
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
  and auth.uid()::text = owner
);

create policy "requirement_documents_insert_own" on storage.objects
for insert with check (
  bucket_id = 'requirement-documents'
  and auth.uid()::text = owner
);

create policy "requirement_documents_update_own" on storage.objects
for update using (
  bucket_id = 'requirement-documents'
  and auth.uid()::text = owner
);

create policy "requirement_documents_delete_own" on storage.objects
for delete using (
  bucket_id = 'requirement-documents'
  and auth.uid()::text = owner
);
