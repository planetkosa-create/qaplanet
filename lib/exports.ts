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
    "Status"
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
    testCase.status
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
    "Source Document",
    "Analysis Item",
    "Test Case ID",
    "Test Case Title",
    "Automation Status",
    "Generated Script",
    "Approval Status"
  ];
  const values = rows.map((row) => [
    row.requirementReference,
    row.sourceDocument,
    row.analysisItem,
    row.testCaseId,
    row.testCaseTitle,
    row.automationStatus,
    row.generatedScript,
    row.approvalStatus
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
