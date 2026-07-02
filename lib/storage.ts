export const appStorageKeys = {
  project: "qaplanet.project",
  requirements: "qaplanet.requirements",
  requirementDraft: "qaplanet.requirementDraft",
  analysis: "qaplanet.analysis",
  testCases: "qaplanet.testCases",
  documents: "qaplanet.documents",
  requirementSources: "qaplanet.requirementSources",
  analysisItems: "qaplanet.analysisItems",
  automationAssessments: "qaplanet.automationAssessments",
  generatedAutomations: "qaplanet.generatedAutomations",
  traceabilityRows: "qaplanet.traceabilityRows",
  selectedTestCases: "qaplanet.selectedTestCases",
  generatedScript: "qaplanet.generatedScript",
  exportHistory: "qaplanet.exportHistory",
  organization: "qaplanet.organization",
  organizationMembers: "qaplanet.organizationMembers",
  invitations: "qaplanet.invitations",
  usageEvents: "qaplanet.usageEvents",
  testRuns: "qaplanet.testRuns",
  localDataCleared: "qaplanet.localDataCleared"
} as const;

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    if (value) {
      return JSON.parse(value) as T;
    }

    if (window.localStorage.getItem(appStorageKeys.localDataCleared) === "true") {
      return emptyValueForClearedWorkspace(key, fallback);
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function clearQaPlanetLocalData() {
  if (typeof window === "undefined") {
    return;
  }

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("qaplanet."))
    .forEach((key) => window.localStorage.removeItem(key));

  window.localStorage.setItem(appStorageKeys.localDataCleared, "true");
}

function emptyValueForClearedWorkspace<T>(key: string, fallback: T): T {
  if (Array.isArray(fallback)) {
    return [] as T;
  }

  if (typeof fallback === "string") {
    return "" as T;
  }

  if (key === appStorageKeys.project) {
    return { name: "", description: "" } as T;
  }

  if (key === appStorageKeys.analysis) {
    return {
      summary: "",
      businessRules: [],
      userStories: [],
      acceptanceCriteria: [],
      risks: [],
      gaps: [],
      assumptions: [],
      actors: [],
      systems: [],
      dataRequirements: []
    } as T;
  }

  if (key === appStorageKeys.generatedScript) {
    return {
      id: "",
      testCaseIds: [],
      name: "No generated script",
      code: "",
      createdAt: new Date().toISOString(),
      language: "typescript",
      framework: "Playwright"
    } as T;
  }

  return fallback;
}
