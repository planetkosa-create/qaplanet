import type { TestCase } from "@/lib/types";

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

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
