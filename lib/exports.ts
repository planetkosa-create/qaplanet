import type { AnalysisItem, AutomationAssessment, TestCase, TraceabilityRow } from "@/lib/types";

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function testCasesToMarkdown(testCases: TestCase[]) {
  return testCases
    .map((testCase) => {
      return `## ${testCase.testCaseId}: ${testCase.name}

**Description:** ${testCase.description}

**Preconditions:** ${testCase.preconditions}

**Steps:**
${testCase.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

**Expected Result:** ${testCase.expectedResult}

**Priority:** ${testCase.priority}

**Type:** ${testCase.type}

**Requirement Reference:** ${testCase.requirementReference}

**Automation Candidate:** ${testCase.automationCandidate ? "Yes" : "No"}

**Automation Readiness:** ${testCase.readiness}

**Automation Notes:** ${testCase.automationNotes}
`;
    })
    .join("\n---\n\n");
}

export function testCasesToCsv(testCases: TestCase[]) {
  const headers = [
    "Test Case ID",
    "Name",
    "Description",
    "Preconditions",
    "Steps",
    "Expected Result",
    "Priority",
    "Type",
    "Requirement Reference",
    "Automation Candidate",
    "Automation Readiness",
    "Automation Notes",
    "Status",
    "Review Notes"
  ];

  const rows = testCases.map((testCase) => [
    testCase.testCaseId,
    testCase.name,
    testCase.description,
    testCase.preconditions,
    testCase.steps.join(" | "),
    testCase.expectedResult,
    testCase.priority,
    testCase.type,
    testCase.requirementReference,
    testCase.automationCandidate ? "Yes" : "No",
    testCase.readiness,
    testCase.automationNotes,
    testCase.approvalStatus ?? testCase.status,
    testCase.reviewNotes ?? ""
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function downloadExcel(testCases: TestCase[]) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(
    testCases.map((testCase) => ({
      "Test Case ID": testCase.testCaseId,
      Name: testCase.name,
      Description: testCase.description,
      Preconditions: testCase.preconditions,
      Steps: testCase.steps.join("\n"),
      "Expected Result": testCase.expectedResult,
      Priority: testCase.priority,
      Type: testCase.type,
      "Requirement Reference": testCase.requirementReference,
      "Automation Candidate": testCase.automationCandidate ? "Yes" : "No",
      "Automation Readiness": testCase.readiness,
      "Automation Notes": testCase.automationNotes,
      Status: testCase.status
    }))
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");
  XLSX.writeFile(workbook, "qaplanet-test-cases.xlsx");
}

export async function downloadWorkbook(sheets: Record<string, Record<string, string | number | boolean>[]>, fileName: string) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName.slice(0, 31));
  });
  XLSX.writeFile(workbook, fileName);
}

export function analysisItemsToCsv(items: AnalysisItem[]) {
  const headers = ["Reference", "Type", "Title", "Description", "Confidence"];
  const rows = items.map((item) => [
    item.referenceCode,
    item.itemType,
    item.title,
    item.description,
    `${Math.round(item.confidenceScore * 100)}%`
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function readinessToCsv(items: AutomationAssessment[]) {
  const headers = ["Test Case", "Readiness", "Confidence", "Reason", "Recommended Framework"];
  const rows = items.map((item) => [
    item.testCaseId,
    item.readiness,
    `${Math.round(item.confidenceScore * 100)}%`,
    item.reason,
    item.recommendedFramework
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function traceabilityToCsv(rows: TraceabilityRow[]) {
  const headers = [
    "Requirement Reference",
    "Requirement Title",
    "Source Document",
    "Analysis Item",
    "Test Case ID",
    "Test Case Title",
    "Priority",
    "Test Type",
    "Automation Status",
    "Generated Script",
    "Approval Status",
    "Coverage Status",
    "Export Status"
  ];
  const values = rows.map((row) => [
    row.requirementReference,
    row.requirementTitle ?? row.requirementReference,
    row.sourceDocument,
    row.analysisItem,
    row.testCaseId,
    row.testCaseTitle,
    row.priority ?? "",
    row.testType ?? "",
    row.automationStatus,
    row.generatedScript,
    row.approvalStatus,
    row.coverageStatus ?? "",
    row.exportStatus ?? ""
  ]);
  return [headers, ...values].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function itemsToMarkdown(title: string, rows: Array<Record<string, unknown>>) {
  return [`# ${title}`, "", "```json", JSON.stringify(rows, null, 2), "```"].join("\n");
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type TestManagementExportOptions = {
  areaPath?: string;
  iterationPath?: string;
  tags?: string;
  assignedTo?: string;
};

export function azureDevOpsTestCasesToCsv(testCases: TestCase[], options: TestManagementExportOptions = {}) {
  const headers = [
    "Title",
    "Test Case ID",
    "Requirement Reference",
    "Priority",
    "Test Type",
    "Automation Status",
    "Approval Status",
    "Preconditions",
    "Steps",
    "Expected Result",
    "Tags",
    "Area Path",
    "Iteration Path",
    "Assigned To"
  ];

  const rows = testCases.map((testCase) => [
    testCase.title ?? testCase.name,
    testCase.testCaseId,
    testCase.requirementReference,
    testCase.priority,
    testCase.testType ?? testCase.type,
    testCase.automationStatus ?? testCase.readiness,
    testCase.approvalStatus ?? testCase.status,
    testCase.preconditions,
    numberedSteps(testCase.steps),
    testCase.expectedResult,
    buildTags(testCase, options.tags),
    options.areaPath ?? "",
    options.iterationPath ?? "",
    options.assignedTo ?? ""
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function jiraTestCasesToCsv(testCases: TestCase[], options: TestManagementExportOptions = {}) {
  const headers = [
    "Summary",
    "Issue Type",
    "Description",
    "Priority",
    "Labels",
    "Test Steps",
    "Expected Result",
    "Requirement Reference",
    "Automation Status",
    "Assignee"
  ];

  const rows = testCases.map((testCase) => [
    `${testCase.testCaseId}: ${testCase.title ?? testCase.name}`,
    "Test",
    testCase.description,
    testCase.priority,
    buildTags(testCase, options.tags).replaceAll(";", ","),
    numberedSteps(testCase.steps),
    testCase.expectedResult,
    testCase.requirementReference,
    testCase.automationStatus ?? testCase.readiness,
    options.assignedTo ?? ""
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function xrayTestCasesToJson(testCases: TestCase[], options: TestManagementExportOptions = {}) {
  return JSON.stringify(
    {
      tests: testCases.map((testCase) => ({
        testInfo: {
          summary: `${testCase.testCaseId}: ${testCase.title ?? testCase.name}`,
          description: testCase.description,
          priority: testCase.priority,
          labels: buildTags(testCase, options.tags).split(";").filter(Boolean),
          requirementReference: testCase.requirementReference,
          automationStatus: testCase.automationStatus ?? testCase.readiness
        },
        steps: testCase.steps.map((step, index) => ({
          action: step,
          data: "",
          result: index === testCase.steps.length - 1 ? testCase.expectedResult : ""
        })),
        expectedResult: testCase.expectedResult
      }))
    },
    null,
    2
  );
}

export function markdownTestPlan(testCases: TestCase[], title = "QAplanet Test Plan") {
  const byPriority = testCases.reduce<Record<string, number>>((accumulator, testCase) => {
    accumulator[testCase.priority] = (accumulator[testCase.priority] ?? 0) + 1;
    return accumulator;
  }, {});

  return [
    `# ${title}`,
    "",
    "## Summary",
    "",
    `- Total test cases: ${testCases.length}`,
    `- Critical: ${byPriority.Critical ?? 0}`,
    `- High: ${byPriority.High ?? 0}`,
    `- Medium: ${byPriority.Medium ?? 0}`,
    `- Low: ${byPriority.Low ?? 0}`,
    "",
    "## Scope",
    "",
    "This plan was generated from QAplanet test cases and is intended for stakeholder review, QA execution planning, and test management import.",
    "",
    "## Test Cases",
    "",
    testCasesToMarkdown(testCases)
  ].join("\n");
}

function numberedSteps(steps: string[]) {
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function buildTags(testCase: TestCase, extraTags?: string) {
  const values = [
    "qaplanet",
    testCase.requirementReference,
    testCase.priority,
    testCase.testType ?? testCase.type,
    testCase.automationStatus ?? testCase.readiness,
    extraTags ?? ""
  ]
    .flatMap((value) => String(value).split(/[;,]/))
    .map((value) => value.trim().replace(/\s+/g, "-").toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(values)).join(";");
}
