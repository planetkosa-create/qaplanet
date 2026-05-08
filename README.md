# QAplanet

QAplanet turns requirements into test cases and automation.

Domain: `qaplanet.ca`

## What This MVP Includes

- Next.js App Router with TypeScript and Tailwind CSS
- Clean enterprise SaaS UI with landing page, auth, dashboard, projects, upload, AI analysis, generated test cases, automation readiness, code generation, exports, execution, team, billing, integrations, and settings
- Supabase Auth login and sign up
- Supabase Storage upload support for `.docx`, `.pdf`, `.xlsx`, and `.txt`
- Supabase Postgres schema for the requested product tables
- OpenAI API routes for requirement analysis, test case generation, automation readiness, and Playwright TypeScript generation
- Playwright TypeScript and Playwright Python automation generation
- Export support for CSV, Markdown, JSON, Excel, Azure DevOps CSV, Jira CSV, Xray JSON, Markdown test plans, and GitHub-ready ZIP packages
- Traceability matrix from requirement source to analysis item to test case to generated automation
- Seed sample project, sample requirements, sample test cases, and sample generated script
- Loading states and basic error handling
- Responsive sidebar and mobile navigation

## File Structure

```txt
app/
  api/
    ai/
      analyze/route.ts
      assess-automation/route.ts
      generate-scripts/route.ts
      generate-test-cases/route.ts
    documents/
      extract/route.ts
  ai-analysis/page.tsx
  analysis/page.tsx
  automation-readiness/page.tsx
  code-generation/page.tsx
  export-center/page.tsx
  dashboard/page.tsx
  execution/page.tsx
  exports/page.tsx
  integrations/page.tsx
  login/page.tsx
  page.tsx
  billing/page.tsx
  team/page.tsx
  projects/page.tsx
  requirements-upload/page.tsx
  settings/page.tsx
  traceability/page.tsx
  test-case-generator/page.tsx
  test-cases/page.tsx
  upload/page.tsx
components/
  app-shell.tsx
  page-header.tsx
  test-case-table.tsx
  ui/
lib/
  ai.ts
  exports.ts
  sample-data.ts
  storage.ts
  supabase.ts
  types.ts
supabase/
  schema.sql
  seed.sql
```

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```

Do not expose `OPENAI_API_KEY` to the browser. It is only used by server routes under `app/api/ai`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open:

```txt
http://localhost:3000
```

4. In Supabase, run:

```txt
supabase/schema.sql
```

5. Optional seed:

Update `sample_owner` in `supabase/seed.sql` to a real `auth.users.id`, then run the seed SQL.

## Supabase Notes

Required tables are included:

- `profiles`
- `projects`
- `uploaded_documents`
- `requirement_sources`
- `requirement_analysis`
- `analysis_items`
- `test_cases`
- `automation_assessments`
- `generated_scripts`
- `generated_automation`
- `exports`
- `organizations`
- `organization_members`
- `project_members`
- `invitations`
- `plans`
- `subscriptions`
- `usage_events`
- `test_runs`
- `test_run_results`

Storage bucket:

- `requirement-documents`

The schema enables RLS and scopes project records to the authenticated owner.

## AI Behavior

The AI routes instruct the model to behave like a senior QA analyst and business analyst. Outputs are structured around:

- Business rules
- User stories
- Acceptance criteria
- Risks
- Gaps
- Assumptions
- Practical enterprise test cases
- Automation readiness
- Playwright TypeScript scripts

Generated test cases include:

- Test Case ID
- Name
- Description
- Preconditions
- Steps
- Expected Result
- Priority
- Type
- Requirement Reference
- Automation Candidate
- Automation Notes

## Playwright Generation Rules

Generated scripts are prompted to use:

- `test.describe`
- `test`
- `expect`
- `page.goto`
- Accessible locators where possible
- Clear comments
- Reusable helper structure when helpful
- Environment variable placeholders instead of secrets

Phase 2 supports both:

- Playwright TypeScript, using `@playwright/test`
- Playwright Python, using `playwright.sync_api` and pytest-style tests

Common test runner placeholders:

```bash
QAPLANET_BASE_URL=
QAPLANET_TEST_USER=
QAPLANET_TEST_PASSWORD=
```

## Phase 2 Workflow

Use these production routes:

- `/requirements-upload`: upload or paste requirement sources
- `/ai-analysis`: extract traceable analysis items
- `/test-case-generator`: generate, filter, edit, approve, reject, and regenerate test cases
- `/automation-readiness`: score automation readiness and select candidates
- `/code-generation`: generate Playwright TypeScript or Python
- `/export-center`: export CSV, Markdown, JSON, and Excel
- `/traceability`: view source-to-analysis-to-test-to-script mapping

Legacy Phase 1 routes such as `/upload`, `/analysis`, `/test-cases`, and `/exports` still work.

## Phase 4 Pages

- `/projects`: project workspace management
- `/execution`: import JSON test execution results and review run history
- `/team`: organization members and pending invitations
- `/billing`: plan cards and usage summary, with payments marked coming soon
- `/integrations`: Azure DevOps, Jira/Xray, GitHub ZIP, Slack, and email readiness

Phase 4 adds integration-ready exports only. Live Azure DevOps, Jira, GitHub OAuth push, Slack, email, and Stripe flows are intentionally marked coming soon.

## First-Run Demo Mode

The app includes sample local data so the workflow is visible before Supabase and OpenAI are configured. Once environment variables are added, auth, storage, document extraction, and AI generation routes are ready to use.

## Verification

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

In this Codex environment, `npm` was not available on PATH and the bundled `node.exe` was blocked, so local install/build verification could not be executed here.

## Deployment Notes

After changing environment variables or pushing Phase 2 code, redeploy in Vercel. If OpenAI calls return `429`, add billing or credits to the OpenAI API organization, create a fresh API key, update `OPENAI_API_KEY`, and redeploy.
