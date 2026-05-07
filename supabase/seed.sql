-- QAplanet seed data
-- Replace the owner_id value with an auth.users.id from your Supabase project before running.

do $$
declare
  sample_owner uuid := '00000000-0000-0000-0000-000000000000';
  sample_project uuid := gen_random_uuid();
  sample_analysis uuid := gen_random_uuid();
  tc_login uuid := gen_random_uuid();
  tc_invalid_login uuid := gen_random_uuid();
begin
  insert into public.projects (id, owner_id, name, description)
  values (
    sample_project,
    sample_owner,
    'Customer portal QA initiative',
    'Sample project for requirements analysis, test case generation, and Playwright automation.'
  );

  insert into public.uploaded_documents (
    project_id,
    owner_id,
    file_name,
    file_type,
    file_size,
    extracted_text
  )
  values (
    sample_project,
    sample_owner,
    'customer-portal-requirements.txt',
    'text/plain',
    1280,
    'As a registered customer, I want to log in with my email and password so that I can view my account dashboard. Customers can filter order history by date range and status. CSV export must include order ID, order date, status, total, and payment status. Support Managers can impersonate customers. Sensitive actions must be audited.'
  );

  insert into public.requirement_analysis (
    id,
    project_id,
    owner_id,
    summary,
    business_rules,
    user_stories,
    acceptance_criteria,
    risks,
    gaps,
    assumptions
  )
  values (
    sample_analysis,
    sample_project,
    sample_owner,
    'Authentication, order history, CSV export, support impersonation, and auditing are in scope.',
    '["Accounts lock after repeated failed login attempts.", "CSV exports must include order and payment fields.", "Only Support Managers may impersonate customers."]'::jsonb,
    '["As a registered customer, I want to log in.", "As a customer, I want to filter order history.", "As a Support Manager, I want to impersonate a customer."]'::jsonb,
    '["Valid credentials sign customers in.", "Invalid credentials show a clear error.", "Locked accounts cannot sign in.", "Sensitive actions create audit events."]'::jsonb,
    '["Impersonation has access-control and audit risk.", "CSV exports can expose sensitive data."]'::jsonb,
    '["MFA behavior is not specified.", "Audit event fields are not defined."]'::jsonb,
    '["Customer and Support Manager roles already exist.", "Order data is available through backend services."]'::jsonb
  );

  insert into public.test_cases (
    id,
    project_id,
    analysis_id,
    owner_id,
    test_case_id,
    name,
    description,
    preconditions,
    steps,
    expected_result,
    priority,
    type,
    requirement_reference,
    automation_candidate,
    automation_notes,
    readiness,
    status
  )
  values
  (
    tc_login,
    sample_project,
    sample_analysis,
    sample_owner,
    'QA-TC-001',
    'Customer logs in with valid credentials',
    'Verify that an active registered customer can authenticate successfully.',
    'Active customer account exists.',
    '["Open the login page.", "Enter valid email.", "Enter valid password.", "Submit the form."]'::jsonb,
    'Customer is signed in and redirected to the dashboard.',
    'Critical',
    'Functional',
    'Login acceptance criteria',
    true,
    'Use seeded test account from environment variables.',
    'Automatable',
    'Approved'
  ),
  (
    tc_invalid_login,
    sample_project,
    sample_analysis,
    sample_owner,
    'QA-TC-002',
    'Invalid login displays clear error',
    'Verify that invalid credentials are rejected and no session is created.',
    'Login page is available.',
    '["Open the login page.", "Enter email.", "Enter incorrect password.", "Submit the form."]'::jsonb,
    'A clear error is displayed and the user remains signed out.',
    'High',
    'Negative',
    'Invalid credentials acceptance criteria',
    true,
    'Use placeholder credentials from test environment variables.',
    'Automatable',
    'Draft'
  );

  insert into public.automation_assessments (
    project_id,
    test_case_id,
    owner_id,
    readiness,
    candidate,
    notes
  )
  values
  (sample_project, tc_login, sample_owner, 'Automatable', true, 'Stable UI flow with seeded test account.'),
  (sample_project, tc_invalid_login, sample_owner, 'Automatable', true, 'Stable negative login path.');

  insert into public.generated_scripts (
    project_id,
    owner_id,
    name,
    test_case_ids,
    code
  )
  values (
    sample_project,
    sample_owner,
    'customer-login.spec.ts',
    array[tc_login, tc_invalid_login],
    'import { test, expect } from "@playwright/test";

const appUrl = process.env.PLAYWRIGHT_BASE_URL;

test.describe("Customer authentication", () => {
  test("QA-TC-001 customer logs in", async ({ page }) => {
    test.skip(!appUrl, "Set PLAYWRIGHT_BASE_URL.");
    await page.goto(`${appUrl}/login`);
    await expect(page.getByRole("heading", { name: /login/i })).toBeVisible();
  });
});'
  );
end $$;
