export type Priority = "Critical" | "High" | "Medium" | "Low";
export type TestCaseType =
  | "Functional"
  | "Negative"
  | "Edge"
  | "Validation"
  | "Security"
  | "Accessibility"
  | "Performance"
  | "Role-based"
  | "Integration"
  | "Regression";
export type AutomationReadiness = "Automatable" | "Needs API/Data" | "Manual Only";
export type TestCaseStatus = "Draft" | "In Review" | "Approved" | "Rejected" | "Needs Update";
export type ProcessingStatus = "Uploaded" | "Extracted" | "Analysis Ready" | "Failed";
export type AnalysisItemType =
  | "Business Rule"
  | "User Story"
  | "Acceptance Criteria"
  | "Risk"
  | "Gap"
  | "Assumption"
  | "Actor / Role"
  | "System / Integration"
  | "Data Requirement";
export type RecommendedFramework = "Playwright" | "API" | "Manual";
export type AutomationLanguage = "typescript" | "python" | "gherkin";
export type CoverageStatus = "Covered" | "Partial" | "Not Covered";

export type Project = {
  id?: string;
  name: string;
  clientName?: string | null;
  applicationName?: string | null;
  releaseName?: string | null;
  description: string | null;
  status?: "Active" | "Archived" | "active" | "archived";
  created_at?: string;
  updated_at?: string;
};

export type RequirementAnalysis = {
  businessRules: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  risks: string[];
  gaps: string[];
  assumptions: string[];
  actors?: string[];
  systems?: string[];
  dataRequirements?: string[];
  summary: string;
};

export type TestCase = {
  id: string;
  testCaseId: string;
  name: string;
  title?: string;
  description: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  priority: Priority;
  type: TestCaseType;
  testType?: TestCaseType;
  requirementReference: string;
  automationCandidate: boolean;
  automationNotes: string;
  readiness: AutomationReadiness;
  automationStatus?: AutomationReadiness;
  readinessConfidence?: number;
  readinessReason?: string;
  recommendedFramework?: RecommendedFramework;
  status: TestCaseStatus;
  approvalStatus?: TestCaseStatus;
  reviewNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  updatedAt?: string;
  analysisItemIds?: string[];
  requirementSourceIds?: string[];
};

export type GeneratedScript = {
  id: string;
  testCaseIds: string[];
  name: string;
  code: string;
  createdAt: string;
  language?: AutomationLanguage;
  framework?: "Playwright" | "Playwright Python" | "Gherkin Feature";
  generationType?: "script" | "pageObject" | "fullPackage" | "apiTests" | "feature" | "pythonBdd";
  linkedFeatureFileName?: string;
};

export type UploadedDocument = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath?: string;
  extractedText?: string;
  createdAt: string;
  processingStatus?: ProcessingStatus;
  projectId?: string;
};

export type RequirementSource = {
  id: string;
  projectId?: string;
  fileName: string;
  sourceType: "Upload" | "Manual Paste";
  fileType: string;
  fileSize: number;
  storagePath?: string;
  extractedText: string;
  processingStatus: ProcessingStatus;
  createdAt: string;
};

export type AnalysisItem = {
  id: string;
  requirementSourceId?: string;
  itemType: AnalysisItemType;
  title: string;
  description: string;
  referenceCode: string;
  confidenceScore: number;
};

export type AutomationAssessment = {
  id: string;
  testCaseId: string;
  readiness: AutomationReadiness;
  confidenceScore: number;
  reason: string;
  recommendedFramework: RecommendedFramework;
};

export type TraceabilityRow = {
  requirementId?: string;
  requirementTitle?: string;
  requirementReference: string;
  sourceDocument: string;
  analysisItem: string;
  testCaseId: string;
  testCaseTitle: string;
  priority?: Priority;
  testType?: TestCaseType;
  automationStatus: AutomationReadiness;
  generatedScript: string;
  approvalStatus: TestCaseStatus;
  coverageStatus?: CoverageStatus;
  exportStatus?: "Not Exported" | "Exported";
};

export type ExportHistoryItem = {
  id: string;
  fileName: string;
  exportType: string;
  createdAt: string;
  rowCount?: number;
};

export type TeamRole = "Owner" | "Admin" | "QA Lead" | "Tester" | "Reviewer" | "Viewer";

export type Organization = {
  id: string;
  name: string;
  ownerId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type OrganizationMember = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: TeamRole;
  status: "Active" | "Pending";
  createdAt: string;
};

export type Invitation = {
  id: string;
  organizationId: string;
  email: string;
  role: TeamRole;
  status: "Pending" | "Accepted" | "Revoked";
  invitedBy?: string;
  createdAt: string;
  acceptedAt?: string;
};

export type PlanName = "Free" | "Pro" | "Team" | "Enterprise";

export type Plan = {
  id: string;
  name: PlanName;
  monthlyPrice: number;
  maxProjects: number | "Unlimited";
  maxDocuments: number | "Unlimited";
  maxAiGenerations: number | "Unlimited";
  maxTeamMembers: number | "Unlimited";
  features: string[];
};

export type UsageEventType =
  | "document_uploaded"
  | "ai_analysis_run"
  | "test_cases_generated"
  | "automation_generated"
  | "export_created"
  | "package_generated";

export type UsageEvent = {
  id: string;
  organizationId?: string;
  projectId?: string;
  userId?: string;
  eventType: UsageEventType;
  quantity: number;
  createdAt: string;
};

export type TestRunResultStatus = "passed" | "failed" | "skipped";

export type TestRunResult = {
  id: string;
  testRunId: string;
  testCaseId?: string;
  testCaseRef: string;
  title: string;
  status: TestRunResultStatus;
  durationSeconds: number;
  errorMessage?: string;
  createdAt: string;
};

export type TestRun = {
  id: string;
  projectId?: string;
  runName: string;
  framework: string;
  source: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationSeconds: number;
  executedAt: string;
  createdAt: string;
  rawResults?: unknown;
  results: TestRunResult[];
};
