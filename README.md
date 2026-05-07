# QAplanet

QAplanet turns requirements into test cases and automation.

Domain: `qaplanet.ca`

## What This MVP Includes

- Next.js App Router with TypeScript and Tailwind CSS
- Clean enterprise SaaS UI with landing page, auth, dashboard, upload, AI analysis, generated test cases, automation readiness, code generation, exports, and settings
- Supabase Auth login and sign up
- Supabase Storage upload support for `.docx`, `.pdf`, `.xlsx`, and `.txt`
- Supabase Postgres schema for the requested product tables
- OpenAI API routes for requirement analysis, test case generation, automation readiness, and Playwright TypeScript generation
- Export support for Markdown, CSV, and Excel
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
  analysis/page.tsx
  automation-readiness/page.tsx
  code-generation/page.tsx
  dashboard/page.tsx
  exports/page.tsx
  login/page.tsx
  page.tsx
  settings/page.tsx
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
- `requirement_analysis`
- `test_cases`
- `automation_assessments`
- `generated_scripts`
- `exports`

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

Common test runner placeholders:

```bash
PLAYWRIGHT_BASE_URL=
TEST_CUSTOMER_EMAIL=
TEST_CUSTOMER_PASSWORD=
TEST_INVALID_EMAIL=
TEST_INVALID_PASSWORD=
```

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
