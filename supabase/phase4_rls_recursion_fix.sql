-- QAplanet Phase 4 RLS recursion hotfix
-- Fixes "infinite recursion detected in policy for relation project_members".
-- Safe to run more than once. This changes policies/functions only; it does not drop data.

create or replace function public.qaplanet_project_role(
  target_project_id uuid,
  target_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.projects p
      where p.id = target_project_id
        and p.owner_id = target_user_id
    ) then 'Owner'
    else (
      select pm.role
      from public.project_members pm
      where pm.project_id = target_project_id
        and pm.user_id = target_user_id
      limit 1
    )
  end
$$;

create or replace function public.qaplanet_can_read_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.qaplanet_project_role(target_project_id, auth.uid()) is not null
$$;

create or replace function public.qaplanet_can_manage_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.qaplanet_project_role(target_project_id, auth.uid()) in ('Owner', 'Admin')
$$;

create or replace function public.qaplanet_can_contribute_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.qaplanet_project_role(target_project_id, auth.uid()) in ('Owner', 'Admin', 'QA Lead', 'Tester', 'Reviewer')
$$;

create or replace function public.qaplanet_org_role(
  target_organization_id uuid,
  target_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.organizations o
      where o.id = target_organization_id
        and o.owner_id = target_user_id
    ) then 'Owner'
    else (
      select om.role
      from public.organization_members om
      where om.organization_id = target_organization_id
        and om.user_id = target_user_id
      limit 1
    )
  end
$$;

create or replace function public.qaplanet_can_read_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.qaplanet_org_role(target_organization_id, auth.uid()) is not null
$$;

create or replace function public.qaplanet_can_manage_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.qaplanet_org_role(target_organization_id, auth.uid()) in ('Owner', 'Admin')
$$;

grant execute on function public.qaplanet_project_role(uuid, uuid) to authenticated;
grant execute on function public.qaplanet_can_read_project(uuid) to authenticated;
grant execute on function public.qaplanet_can_manage_project(uuid) to authenticated;
grant execute on function public.qaplanet_can_contribute_project(uuid) to authenticated;
grant execute on function public.qaplanet_org_role(uuid, uuid) to authenticated;
grant execute on function public.qaplanet_can_read_org(uuid) to authenticated;
grant execute on function public.qaplanet_can_manage_org(uuid) to authenticated;

-- Replace recursive Phase 4 policies.
drop policy if exists "projects_crud_own" on public.projects;
drop policy if exists "project_members_member_access" on public.project_members;
drop policy if exists "organization_members_member_access" on public.organization_members;
drop policy if exists "organizations_member_access" on public.organizations;
drop policy if exists "invitations_admin_access" on public.invitations;
drop policy if exists "subscriptions_owner_admin_read" on public.subscriptions;
drop policy if exists "subscriptions_member_read" on public.subscriptions;
drop policy if exists "usage_events_member_access" on public.usage_events;
drop policy if exists "test_runs_project_access" on public.test_runs;
drop policy if exists "test_run_results_project_access" on public.test_run_results;

drop policy if exists "requirement_sources_crud_own" on public.requirement_sources;
drop policy if exists "analysis_items_crud_own" on public.analysis_items;
drop policy if exists "test_cases_crud_own" on public.test_cases;
drop policy if exists "automation_assessments_crud_own" on public.automation_assessments;
drop policy if exists "generated_automation_crud_own" on public.generated_automation;
drop policy if exists "exports_crud_own" on public.exports;

create policy "organizations_member_access" on public.organizations
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_org(id)
) with check (owner_id = auth.uid());

create policy "organization_members_member_access" on public.organization_members
for all using (
  user_id = auth.uid()
  or public.qaplanet_can_manage_org(organization_id)
) with check (public.qaplanet_can_manage_org(organization_id));

create policy "projects_crud_own" on public.projects
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_project(id)
) with check (
  owner_id = auth.uid()
  or public.qaplanet_can_manage_project(id)
);

create policy "project_members_member_access" on public.project_members
for all using (
  user_id = auth.uid()
  or public.qaplanet_can_manage_project(project_id)
) with check (public.qaplanet_can_manage_project(project_id));

create policy "invitations_admin_access" on public.invitations
for all using (public.qaplanet_can_manage_org(organization_id))
with check (public.qaplanet_can_manage_org(organization_id));

create policy "subscriptions_member_read" on public.subscriptions
for select using (public.qaplanet_can_manage_org(organization_id));

create policy "usage_events_member_access" on public.usage_events
for all using (
  user_id = auth.uid()
  or public.qaplanet_can_read_org(organization_id)
  or public.qaplanet_can_read_project(project_id)
) with check (user_id = auth.uid() or user_id is null);

create policy "requirement_sources_crud_own" on public.requirement_sources
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_project(project_id)
) with check (
  owner_id = auth.uid()
  or public.qaplanet_can_contribute_project(project_id)
);

create policy "analysis_items_crud_own" on public.analysis_items
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_project(project_id)
) with check (
  owner_id = auth.uid()
  or public.qaplanet_can_contribute_project(project_id)
);

create policy "test_cases_crud_own" on public.test_cases
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_project(project_id)
) with check (
  owner_id = auth.uid()
  or public.qaplanet_can_contribute_project(project_id)
);

create policy "automation_assessments_crud_own" on public.automation_assessments
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_project(project_id)
) with check (
  owner_id = auth.uid()
  or public.qaplanet_can_contribute_project(project_id)
);

create policy "generated_automation_crud_own" on public.generated_automation
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_project(project_id)
) with check (
  owner_id = auth.uid()
  or public.qaplanet_can_contribute_project(project_id)
);

create policy "exports_crud_own" on public.exports
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_project(project_id)
) with check (
  owner_id = auth.uid()
  or public.qaplanet_can_contribute_project(project_id)
);

create policy "test_runs_project_access" on public.test_runs
for all using (
  owner_id = auth.uid()
  or public.qaplanet_can_read_project(project_id)
) with check (
  owner_id = auth.uid()
  or public.qaplanet_project_role(project_id, auth.uid()) in ('Owner', 'Admin', 'QA Lead', 'Tester')
);

create policy "test_run_results_project_access" on public.test_run_results
for all using (
  exists (
    select 1
    from public.test_runs tr
    where tr.id = test_run_results.test_run_id
      and (
        tr.owner_id = auth.uid()
        or public.qaplanet_can_read_project(tr.project_id)
      )
  )
) with check (
  exists (
    select 1
    from public.test_runs tr
    where tr.id = test_run_results.test_run_id
      and (
        tr.owner_id = auth.uid()
        or public.qaplanet_project_role(tr.project_id, auth.uid()) in ('Owner', 'Admin', 'QA Lead', 'Tester')
      )
  )
);
