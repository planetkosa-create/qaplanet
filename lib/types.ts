export type Priority = "Critical" | "High" | "Medium" | "Low";
export type TestCaseType =
  | "Functional"
  | "Negative"
  | "Edge"
  | "Validation"
  | "Role-based"
  | "Integration"
  | "Regression";
export type AutomationReadiness = "Automatable" | "Needs API/Data" | "Manual Only";
export type TestCaseStatus = "Draft" | "Approved" | "Rejected";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
};

export type RequirementAnalysis = {
  businessRules: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  risks: string[];
  gaps: string[];
  assumptions: string[];
  summary: string;
};

export type TestCase = {
  id: string;
  testCaseId: string;
  name: string;
  description: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  priority: Priority;
  type: TestCaseType;
  requirementReference: string;
  automationCandidate: boolean;
  automationNotes: string;
  readiness: AutomationReadiness;
  status: TestCaseStatus;
};

export type GeneratedScript = {
  id: string;
  testCaseIds: string[];
  name: string;
  code: string;
  createdAt: string;
};

export type UploadedDocument = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath?: string;
  extractedText?: string;
  createdAt: string;
};
