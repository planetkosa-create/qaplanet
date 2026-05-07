import OpenAI from "openai";
import type { RequirementAnalysis, TestCase } from "@/lib/types";

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
    "type": "Functional|Negative|Edge|Validation|Role-based|Integration|Regression",
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
