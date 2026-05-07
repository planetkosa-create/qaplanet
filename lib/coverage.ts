import type { AnalysisItem, AutomationReadiness, CoverageStatus, RequirementSource, TestCase } from "@/lib/types";

export type CoverageRow = {
  requirementReference: string;
  requirementTitle: string;
  testCaseCount: number;
  approvedCount: number;
  automationCount: number;
  coverageStatus: CoverageStatus;
};

export type CoverageSummary = {
  totalRequirements: number;
  requirementsCovered: number;
  requirementsWithoutTestCases: number;
  totalTestCases: number;
  approvedTestCases: number;
  automatable: number;
  needsApiData: number;
  manualOnly: number;
  risks: number;
  gaps: number;
  rows: CoverageRow[];
};

export function buildCoverageSummary({
  sources,
  analysisItems,
  testCases
}: {
  sources: RequirementSource[];
  analysisItems: AnalysisItem[];
  testCases: TestCase[];
}): CoverageSummary {
  const requirements = buildRequirementRegister(sources, analysisItems, testCases);

  const rows = requirements.map((requirement) => {
    const linkedCases = testCases.filter((testCase) => {
      const reference = testCase.requirementReference || "";
      return (
        reference === requirement.reference ||
        testCase.analysisItemIds?.includes(requirement.id) ||
        testCase.requirementSourceIds?.includes(requirement.id)
      );
    });
    const approvedCount = linkedCases.filter((testCase) => (testCase.approvalStatus ?? testCase.status) === "Approved").length;
    const automationCount = linkedCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Automatable").length;
    const coverageStatus: CoverageStatus =
      linkedCases.length === 0 ? "Not Covered" : approvedCount > 0 || automationCount > 0 ? "Covered" : "Partial";

    return {
      requirementReference: requirement.reference,
      requirementTitle: requirement.title,
      testCaseCount: linkedCases.length,
      approvedCount,
      automationCount,
      coverageStatus
    };
  });

  const automatable = testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Automatable").length;
  const needsApiData = testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Needs API/Data").length;
  const manualOnly = testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Manual Only").length;

  return {
    totalRequirements: rows.length,
    requirementsCovered: rows.filter((row) => row.coverageStatus === "Covered").length,
    requirementsWithoutTestCases: rows.filter((row) => row.testCaseCount === 0).length,
    totalTestCases: testCases.length,
    approvedTestCases: testCases.filter((testCase) => (testCase.approvalStatus ?? testCase.status) === "Approved").length,
    automatable,
    needsApiData,
    manualOnly,
    risks: analysisItems.filter((item) => item.itemType === "Risk").length,
    gaps: analysisItems.filter((item) => item.itemType === "Gap").length,
    rows
  };
}

function buildRequirementRegister(sources: RequirementSource[], analysisItems: AnalysisItem[], testCases: TestCase[]) {
  const register = new Map<string, { id: string; reference: string; title: string }>();

  analysisItems
    .filter((item) => ["Business Rule", "User Story", "Acceptance Criteria", "Data Requirement"].includes(item.itemType))
    .forEach((item) => {
      register.set(item.referenceCode, {
        id: item.id,
        reference: item.referenceCode,
        title: item.title
      });
    });

  testCases.forEach((testCase) => {
    const reference = testCase.requirementReference || "UNMAPPED";
    if (!register.has(reference)) {
      register.set(reference, {
        id: testCase.id,
        reference,
        title: testCase.title ?? testCase.name
      });
    }
  });

  if (!register.size) {
    sources.forEach((source, index) => {
      register.set(`SRC-${String(index + 1).padStart(3, "0")}`, {
        id: source.id,
        reference: `SRC-${String(index + 1).padStart(3, "0")}`,
        title: source.fileName
      });
    });
  }

  return [...register.values()].sort((a, b) => a.reference.localeCompare(b.reference));
}

export function readinessCount(testCases: TestCase[], readiness: AutomationReadiness) {
  return testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === readiness).length;
}
