import { sampleRequirements, sampleScript, sampleTestCases } from "@/lib/sample-data";
import type { AnalysisItem, AutomationAssessment, GeneratedScript, RequirementSource, TraceabilityRow } from "@/lib/types";

export const sampleRequirementSources: RequirementSource[] = [
  {
    id: "src-001",
    fileName: "customer-portal-requirements.txt",
    sourceType: "Upload",
    fileType: "text/plain",
    fileSize: sampleRequirements.length,
    extractedText: sampleRequirements,
    processingStatus: "Analysis Ready",
    createdAt: new Date().toISOString()
  }
];

export const sampleAnalysisItems: AnalysisItem[] = [
  {
    id: "ai-001",
    requirementSourceId: "src-001",
    itemType: "Business Rule",
    title: "Account lockout after failed attempts",
    description: "A user with more than five failed login attempts is locked for 30 minutes.",
    referenceCode: "BR-001",
    confidenceScore: 0.95
  },
  {
    id: "ai-002",
    requirementSourceId: "src-001",
    itemType: "Acceptance Criteria",
    title: "Valid login redirects to dashboard",
    description: "Customers can log in with valid credentials and access their account dashboard.",
    referenceCode: "AC-001",
    confidenceScore: 0.96
  },
  {
    id: "ai-003",
    requirementSourceId: "src-001",
    itemType: "Risk",
    title: "Impersonation access control",
    description: "Support impersonation can expose sensitive account data if role checks or audit logs are incomplete.",
    referenceCode: "RSK-001",
    confidenceScore: 0.88
  },
  {
    id: "ai-004",
    requirementSourceId: "src-001",
    itemType: "Actor / Role",
    title: "Support Manager",
    description: "Only Support Manager users can impersonate a customer for troubleshooting.",
    referenceCode: "ROLE-001",
    confidenceScore: 0.92
  },
  {
    id: "ai-005",
    requirementSourceId: "src-001",
    itemType: "Data Requirement",
    title: "CSV order export fields",
    description: "CSV exports must include order ID, order date, order status, total, and payment status.",
    referenceCode: "DATA-001",
    confidenceScore: 0.94
  }
];

export const sampleAutomationAssessments: AutomationAssessment[] = sampleTestCases.map((testCase) => ({
  id: `assess-${testCase.id}`,
  testCaseId: testCase.id,
  readiness: testCase.readiness,
  confidenceScore: testCase.readiness === "Automatable" ? 0.9 : 0.74,
  reason:
    testCase.readiness === "Automatable"
      ? "Clear repeatable UI flow with stable expected result."
      : "Automation is feasible after seeded data and API validation hooks are available.",
  recommendedFramework: testCase.readiness === "Automatable" ? "Playwright" : "API"
}));

export const samplePythonScript: GeneratedScript = {
  id: "script-python-001",
  testCaseIds: ["tc-001", "tc-002"],
  name: "customer_login.spec.py",
  language: "python",
  framework: "Playwright",
  createdAt: new Date().toISOString(),
  code: `import os
from playwright.sync_api import Page, expect

BASE_URL = os.environ.get("QAPLANET_BASE_URL", "http://localhost:3000")
TEST_USER = os.environ.get("QAPLANET_TEST_USER")
TEST_PASSWORD = os.environ.get("QAPLANET_TEST_PASSWORD")


def test_customer_logs_in_with_valid_credentials(page: Page):
    assert TEST_USER and TEST_PASSWORD, "Set QAPLANET_TEST_USER and QAPLANET_TEST_PASSWORD."

    page.goto(f"{BASE_URL}/login")
    page.get_by_label("Email").fill(TEST_USER)
    page.get_by_label("Password").fill(TEST_PASSWORD)
    page.get_by_role("button", name="Sign in").click()

    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible()
`
};

export const sampleGeneratedAutomations: GeneratedScript[] = [
  { ...sampleScript, language: "typescript", framework: "Playwright" },
  samplePythonScript
];

export function buildSampleTraceability(): TraceabilityRow[] {
  return sampleTestCases.map((testCase, index) => ({
    requirementReference: testCase.requirementReference,
    sourceDocument: sampleRequirementSources[0].fileName,
    analysisItem: sampleAnalysisItems[index % sampleAnalysisItems.length].referenceCode,
    testCaseId: testCase.testCaseId,
    testCaseTitle: testCase.name,
    automationStatus: testCase.readiness,
    generatedScript: testCase.readiness === "Automatable" ? sampleScript.name : "Not generated",
    approvalStatus: testCase.status
  }));
}
