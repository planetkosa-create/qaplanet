import OpenAI from "openai";
import type { AnalysisItem, AutomationLanguage, RequirementAnalysis, RequirementSource, TestCase } from "@/lib/types";

export const qaSystemPrompt = `You are a senior QA analyst and business analyst. Produce practical, structured, enterprise-ready QA outputs from requirements. Include typical use cases, edge cases, negative scenarios, role-based scenarios, validation scenarios, and integration scenarios where applicable. Be specific and avoid inventing secrets, credentials, or unsupported product behavior.`;

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export function getJsonInstruction(schemaDescription: string) {
  return `Return only valid JSON. Do not include markdown fences. Shape: ${schemaDescription}`;
}

export function buildAnalysisPrompt(requirements: string) {
  return `${qaSystemPrompt}

Analyze these requirements and extract business rules, user stories, acceptance criteria, risks, gaps, assumptions, and a concise summary.

${getJsonInstruction(`{
  "summary": "string",
  "businessRules": ["string"],
  "userStories": ["string"],
  "acceptanceCriteria": ["string"],
  "risks": ["string"],
  "gaps": ["string"],
  "assumptions": ["string"]
}`)}

Requirements:
${requirements}`;
}

export function buildAnalysisItemsPrompt(sources: RequirementSource[]) {
  return `${qaSystemPrompt}

Analyze the requirement sources and extract atomic, traceable analysis items.

For each item include:
- itemType: one of Business Rule, User Story, Acceptance Criteria, Risk, Gap, Assumption, Actor / Role, System / Integration, Data Requirement
- title
- description
- referenceCode using prefixes BR, US, AC, RSK, GAP, ASM, ROLE, SYS, DATA
- confidenceScore from 0 to 1
- requirementSourceId when identifiable

${getJsonInstruction(`{
  "summary": "string",
  "analysisItems": [{
    "requirementSourceId": "string",
    "itemType": "Business Rule|User Story|Acceptance Criteria|Risk|Gap|Assumption|Actor / Role|System / Integration|Data Requirement",
    "title": "string",
    "description": "string",
    "referenceCode": "BR-001",
    "confidenceScore": 0.91
  }]
}`)}

Requirement sources:
${JSON.stringify(
  sources.map((source) => ({
    id: source.id,
    fileName: source.fileName,
    text: source.extractedText
  })),
  null,
  2
)}`;
}

export function buildTestCasePrompt(requirements: string, analysis: RequirementAnalysis) {
  return `${qaSystemPrompt}

Generate enterprise-ready test cases from the requirements and analysis. Cover happy paths, negative paths, edge cases, role-based scenarios, validation behavior, integration behavior, and regression-relevant flows.

${getJsonInstruction(`{
  "testCases": [{
    "testCaseId": "QA-TC-001",
    "name": "string",
    "description": "string",
    "preconditions": "string",
    "steps": ["string"],
    "expectedResult": "string",
    "priority": "Critical|High|Medium|Low",
    "type": "Functional|Negative|Edge|Security|Integration|Accessibility|Performance|Regression",
    "requirementReference": "string",
    "automationCandidate": true,
    "automationNotes": "string",
    "readiness": "Automatable|Needs API/Data|Manual Only"
  }]
}`)}

Requirements:
${requirements}

Analysis:
${JSON.stringify(analysis, null, 2)}`;
}

export function buildPhase2TestCasePrompt(
  sources: RequirementSource[],
  analysisItems: AnalysisItem[],
  options?: { batchName?: string; coverageFocus?: string[]; startNumber?: number; minimumCount?: number }
) {
  const coverageFocus = options?.coverageFocus?.length
    ? options.coverageFocus
    : [
        "Registration validation",
        "Login and account lockout",
        "Role-based access control",
        "Draft creation and duplicate draft prevention",
        "Required field validation",
        "Application save and resume",
        "Document upload validation",
        "Required document enforcement",
        "Application submission",
        "Read-only submitted applications",
        "Application status visibility",
        "Withdrawal rules",
        "Reviewer queue filtering and sorting",
        "Reviewer status updates",
        "Administrator configuration",
        "Audit history",
        "Notification triggers",
        "Accessibility checks",
        "Performance checks",
        "Security checks"
      ];

  return `${qaSystemPrompt}

You are a senior QA Lead generating enterprise-level test coverage. Based on the full BRD, analysis items, business rules, acceptance criteria, risks, gaps, assumptions, and suggested test coverage areas, generate a comprehensive set of test cases. Do not summarize. Do not generate fewer than 25 test cases when sufficient requirements exist. Cover positive, negative, edge, role-based, validation, security, integration, accessibility, performance, and audit scenarios where applicable.

Batch focus: ${options?.batchName ?? "Full BRD coverage"}

Coverage areas to target in this response:
${coverageFocus.map((area) => `- ${area}`).join("\n")}

Generation rules:
- Use requirement_sources.extracted_text, analysis_items, business rules, acceptance criteria, risks, gaps, and assumptions.
- Explicitly inspect and use any "Suggested Test Coverage Areas" section in the BRD.
- Do not generate only one test case per analysis item.
- Do not stop after six test cases.
- For each major functional requirement, generate at least one happy path, one negative test, and one validation or edge case where applicable.
- Include security, role-based, integration/API/data, accessibility, performance, audit, and notification scenarios when present.
- Generate at least ${options?.minimumCount ?? 7} test cases for this batch when the BRD contains enough relevant detail.
- Start numbering at QA-TC-${String(options?.startNumber ?? 1).padStart(3, "0")}.
- Default approval_status/status to Draft.
- Use only these priority values: Critical, High, Medium, Low.
- Use only these test_type/type values: Functional, Negative, Edge, Security, Integration, Accessibility, Performance, Regression.
- Use only these automation_status/readiness values: Automatable, Needs API/Data, Manual Only.

Each test case must include a clear trace back to analysis item reference codes and requirement source IDs.

${getJsonInstruction(`{
  "test_cases": [{
    "test_case_id": "QA-TC-001",
    "requirement_reference": "REQ-001 or coverage area name",
    "title": "string",
    "description": "string",
    "preconditions": "string",
    "steps": ["string"],
    "expected_result": "string",
    "priority": "Critical|High|Medium|Low",
    "test_type": "Functional|Negative|Edge|Security|Integration|Accessibility|Performance|Regression",
    "automation_candidate": true,
    "automation_status": "Automatable|Needs API/Data|Manual Only",
    "automation_notes": "string",
    "approval_status": "Draft",
    "analysis_item_ids": ["string"],
    "requirement_source_ids": ["string"]
  }]
}`)}

Requirement sources:
${JSON.stringify(
  sources.map((source) => ({
    id: source.id,
    fileName: source.fileName,
    extracted_text: source.extractedText
  })),
  null,
  2
)}

Analysis items:
${JSON.stringify(analysisItems, null, 2)}`;
}

export function buildAutomationAssessmentPrompt(testCases: TestCase[]) {
  return `${qaSystemPrompt}

Evaluate automation readiness for each test case. Use:
- Automatable when a stable UI or API automation path is clear.
- Needs API/Data when fixtures, test data, service mocks, backend validation, or API setup are required.
- Manual Only when human judgment, exploratory review, visual nuance, or unavailable system access makes automation unsuitable.

${getJsonInstruction(`{
  "assessments": [{
    "testCaseId": "QA-TC-001",
    "readiness": "Automatable|Needs API/Data|Manual Only",
    "automationCandidate": true,
    "notes": "string"
  }]
}`)}

Test cases:
${JSON.stringify(testCases, null, 2)}`;
}

export function buildScriptPrompt(testCases: TestCase[]) {
  return `${qaSystemPrompt}

Generate clean Playwright TypeScript automation scripts for the selected test cases.

Rules:
- Use @playwright/test.
- Use test.describe, test, expect, page.goto.
- Prefer accessible locators: getByRole, getByLabel, getByText.
- Add clear comments only where useful.
- Use reusable helpers when they reduce duplication.
- Do not generate fake secrets or real credentials.
- Use placeholders and environment variables.
- Keep the code maintainable.

Return only valid JSON:
{
  "fileName": "string ending in .spec.ts",
  "code": "string"
}

Selected test cases:
${JSON.stringify(testCases, null, 2)}`;
}

export function buildAutomationScriptPrompt(testCases: TestCase[], language: AutomationLanguage) {
  const languageRules =
    language === "python"
      ? "Generate Playwright Python code using pytest style and playwright.sync_api. Use Page, expect, page.goto, accessible locators, helpers when useful, and placeholders from os.environ."
      : "Generate Playwright TypeScript code using @playwright/test. Use test.describe, test, expect, page.goto, accessible locators, helpers when useful, and process.env placeholders.";

  return `${qaSystemPrompt}

Generate maintainable Playwright ${language === "python" ? "Python" : "TypeScript"} automation for the selected approved automatable test cases.

Rules:
- ${languageRules}
- Include comments showing where selectors must be updated when requirements do not specify exact UI labels.
- Do not generate secrets or fake credentials.
- Use these placeholders only:
  - QAPLANET_BASE_URL
  - QAPLANET_TEST_USER
  - QAPLANET_TEST_PASSWORD
- Keep code clean and production-ready for a QA automation repository.

Return only valid JSON:
{
  "fileName": "string ending in ${language === "python" ? ".spec.py" : ".spec.ts"}",
  "code": "string"
}

Selected test cases:
${JSON.stringify(testCases, null, 2)}`;
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return fallback;
      }
    }

    return fallback;
  }
}
