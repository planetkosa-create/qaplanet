import type { GeneratedScript, RequirementAnalysis, TestCase, UploadedDocument } from "@/lib/types";

export const sampleRequirements = `Project: Customer self-service portal

As a registered customer, I want to log in with my email and password so that I can view my account dashboard.

Acceptance criteria:
- Customers can log in with valid credentials.
- Invalid credentials show a clear error message and do not sign the user in.
- Locked accounts must not be allowed to log in.
- Customers can filter their order history by date range and status.
- Exporting order history creates a downloadable CSV file.
- Admin users can impersonate a customer only when they have the Support Manager role.
- All sensitive actions must be audited.

Business rules:
- Passwords must never be displayed.
- Date filters cannot exceed a 24 month range.
- CSV exports must include order ID, order date, order status, total, and payment status.
- A user with more than five failed login attempts is locked for 30 minutes.`;

export const sampleAnalysis: RequirementAnalysis = {
  summary:
    "The requirement set covers authentication, order history filtering, CSV export, role-based support access, and audit obligations.",
  businessRules: [
    "Customers authenticate with email and password.",
    "Accounts with more than five failed login attempts are locked for 30 minutes.",
    "Order date filters cannot exceed a 24 month range.",
    "CSV exports must include order ID, date, status, total, and payment status.",
    "Support impersonation is limited to users with the Support Manager role."
  ],
  userStories: [
    "As a registered customer, I want to log in so that I can view my account dashboard.",
    "As a customer, I want to filter order history so that I can find specific orders.",
    "As a customer, I want to export order history so that I can reconcile purchases.",
    "As a support manager, I want to impersonate a customer so that I can troubleshoot account issues."
  ],
  acceptanceCriteria: [
    "Valid credentials sign the customer in.",
    "Invalid credentials show a clear error and keep the user signed out.",
    "Locked accounts cannot sign in.",
    "Order history can be filtered by date range and status.",
    "Order history can be exported to CSV.",
    "Sensitive actions create audit events."
  ],
  risks: [
    "Authentication and impersonation features carry privacy and access-control risk.",
    "CSV export can leak sensitive order data if authorization checks are incomplete.",
    "Date range filtering can create performance issues on large order histories."
  ],
  gaps: [
    "No password reset or multi-factor authentication behavior is specified.",
    "Audit event fields and retention requirements are undefined.",
    "CSV export limits and async behavior are not specified for large result sets."
  ],
  assumptions: [
    "The portal already has customer, admin, and support manager roles.",
    "Order data is available through an authenticated backend service.",
    "CSV downloads are generated server-side and scoped to the signed-in user."
  ]
};

export const sampleTestCases: TestCase[] = [
  {
    id: "tc-001",
    testCaseId: "QA-TC-001",
    name: "Customer logs in with valid credentials",
    description: "Verify that a registered customer can authenticate and access the dashboard.",
    preconditions: "A registered active customer account exists.",
    steps: [
      "Open the login page.",
      "Enter a valid customer email.",
      "Enter the valid password.",
      "Submit the login form."
    ],
    expectedResult: "The customer is signed in and redirected to the account dashboard.",
    priority: "Critical",
    type: "Functional",
    requirementReference: "Login acceptance criteria",
    automationCandidate: true,
    automationNotes: "Good UI automation candidate using seeded test account from environment variables.",
    readiness: "Automatable",
    status: "Approved"
  },
  {
    id: "tc-002",
    testCaseId: "QA-TC-002",
    name: "Invalid login displays clear error",
    description: "Verify invalid credentials are rejected without creating an authenticated session.",
    preconditions: "The customer login page is available.",
    steps: [
      "Open the login page.",
      "Enter a valid-looking customer email.",
      "Enter an incorrect password.",
      "Submit the login form."
    ],
    expectedResult: "An error message is displayed and the user remains signed out.",
    priority: "High",
    type: "Negative",
    requirementReference: "Invalid credentials acceptance criteria",
    automationCandidate: true,
    automationNotes: "Use placeholder credentials from test environment variables.",
    readiness: "Automatable",
    status: "Draft"
  },
  {
    id: "tc-003",
    testCaseId: "QA-TC-003",
    name: "Order date filter rejects ranges over 24 months",
    description: "Verify that the order history filter enforces the maximum date range.",
    preconditions: "A customer is signed in and has access to order history.",
    steps: [
      "Navigate to order history.",
      "Set the start date more than 24 months before the end date.",
      "Apply the filter."
    ],
    expectedResult: "The filter is not applied and a validation message explains the 24 month limit.",
    priority: "Medium",
    type: "Validation",
    requirementReference: "Date range business rule",
    automationCandidate: true,
    automationNotes: "Requires deterministic date controls and accessible validation messaging.",
    readiness: "Needs API/Data",
    status: "Draft"
  },
  {
    id: "tc-004",
    testCaseId: "QA-TC-004",
    name: "Support impersonation is denied for non-manager role",
    description: "Verify role-based access prevents unauthorized impersonation.",
    preconditions: "A support user without Support Manager role exists.",
    steps: [
      "Sign in as the non-manager support user.",
      "Open a customer profile.",
      "Attempt to start impersonation."
    ],
    expectedResult: "The user is denied access and no impersonation session is created.",
    priority: "Critical",
    type: "Role-based",
    requirementReference: "Support Manager impersonation rule",
    automationCandidate: true,
    automationNotes: "Requires role fixtures and backend verification that no impersonation token is issued.",
    readiness: "Needs API/Data",
    status: "Draft"
  }
];

export const sampleDocuments: UploadedDocument[] = [
  {
    id: "doc-001",
    fileName: "customer-portal-requirements.txt",
    fileType: "text/plain",
    fileSize: sampleRequirements.length,
    extractedText: sampleRequirements,
    createdAt: new Date().toISOString()
  }
];

export const sampleScript: GeneratedScript = {
  id: "script-001",
  testCaseIds: ["tc-001", "tc-002"],
  name: "customer-login.spec.ts",
  createdAt: new Date().toISOString(),
  code: `import { test, expect } from "@playwright/test";

const appUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const customerEmail = process.env.TEST_CUSTOMER_EMAIL;
const customerPassword = process.env.TEST_CUSTOMER_PASSWORD;
const invalidEmail = process.env.TEST_INVALID_EMAIL;
const invalidPassword = process.env.TEST_INVALID_PASSWORD;

test.describe("Customer authentication", () => {
  test("QA-TC-001 customer logs in with valid credentials", async ({ page }) => {
    test.skip(!customerEmail || !customerPassword, "Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD.");

    await page.goto(\`\${appUrl}/login\`);
    await page.getByLabel("Email").fill(customerEmail!);
    await page.getByLabel("Password").fill(customerPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("QA-TC-002 invalid login displays clear error", async ({ page }) => {
    test.skip(!invalidEmail || !invalidPassword, "Set TEST_INVALID_EMAIL and TEST_INVALID_PASSWORD.");

    await page.goto(\`\${appUrl}/login\`);
    await page.getByLabel("Email").fill(invalidEmail!);
    await page.getByLabel("Password").fill(invalidPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid|incorrect|unable to sign in/i)).toBeVisible();
  });
});`
};
