import type {
  AnalysisItem,
  AutomationAssessment,
  AutomationReadiness,
  GeneratedScript,
  Priority,
  Project,
  RecommendedFramework,
  RequirementSource,
  TestCase,
  TestCaseStatus,
  TestCaseType,
  UploadedDocument
} from "@/lib/types";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { isUuid, sanitizeProject } from "@/lib/project-context";

type SupabaseClient = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;

const priorities: Priority[] = ["Critical", "High", "Medium", "Low"];
const testTypes: TestCaseType[] = [
  "Functional",
  "Negative",
  "Edge",
  "Validation",
  "Security",
  "Accessibility",
  "Performance",
  "Role-based",
  "Integration",
  "Regression"
];
const readinessValues: AutomationReadiness[] = ["Automatable", "Needs API/Data", "Manual Only"];
const statuses: TestCaseStatus[] = ["Draft", "In Review", "Approved", "Rejected", "Needs Update"];
const frameworks: RecommendedFramework[] = ["Playwright", "API", "Manual"];

export type WorkspaceSnapshot = {
  project: Project;
  requirementSources: RequirementSource[];
  documents: UploadedDocument[];
  analysisItems: AnalysisItem[];
  testCases: TestCase[];
  automationAssessments: AutomationAssessment[];
  generatedAutomations: GeneratedScript[];
};

export async function loadSupabaseWorkspace(preferredProjectId?: string): Promise<WorkspaceSnapshot | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const userResult = await supabase.auth.getUser();
  const userId = userResult.data.user?.id;
  if (!userId) {
    return null;
  }

  const projectResult = preferredProjectId
    ? await supabase
        .from("projects")
        .select("id, name, description, client_name, application_name, release_name, status, created_at, updated_at")
        .eq("id", preferredProjectId)
        .maybeSingle()
    : await supabase
        .from("projects")
        .select("id, name, description, client_name, application_name, release_name, status, created_at, updated_at")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  if (projectResult.error || !projectResult.data) {
    return null;
  }

  const project = rowToProject(projectResult.data as Record<string, unknown>);
  const projectId = project.id;
  if (!projectId) {
    return null;
  }

  const [sourcesResult, analysisResult, testCasesResult, assessmentsResult, automationResult] = await Promise.all([
    supabase.from("requirement_sources").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("analysis_items").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("test_cases").select("*").eq("project_id", projectId).order("test_case_id", { ascending: true }),
    supabase.from("automation_assessments").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("generated_automation").select("*").eq("project_id", projectId).order("created_at", { ascending: false })
  ]);

  const requirementSources = Array.isArray(sourcesResult.data) ? sourcesResult.data.map(rowToRequirementSource) : [];
  const analysisItems = Array.isArray(analysisResult.data) ? analysisResult.data.map(rowToAnalysisItem) : [];
  const testCases = Array.isArray(testCasesResult.data) ? testCasesResult.data.map(rowToTestCase) : [];
  const automationAssessments = Array.isArray(assessmentsResult.data) ? assessmentsResult.data.map(rowToAutomationAssessment) : [];
  const generatedAutomations = Array.isArray(automationResult.data) ? automationResult.data.map(rowToGeneratedScript) : [];

  return {
    project,
    requirementSources,
    documents: requirementSources.map(sourceToDocument),
    analysisItems,
    testCases,
    automationAssessments,
    generatedAutomations
  };
}

export function writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  writeJson(appStorageKeys.project, snapshot.project);
  writeJson(appStorageKeys.requirementSources, snapshot.requirementSources);
  writeJson(appStorageKeys.documents, snapshot.documents);
  writeJson(appStorageKeys.analysisItems, snapshot.analysisItems);
  writeJson(appStorageKeys.testCases, snapshot.testCases);
  writeJson(appStorageKeys.automationAssessments, snapshot.automationAssessments);
  writeJson(appStorageKeys.generatedAutomations, snapshot.generatedAutomations);
  writeJson(appStorageKeys.requirements, snapshot.requirementSources.map((source) => source.extractedText).join("\n\n"));
}

export async function syncLocalWorkflowToSupabase(projectId: string) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase || !isUuid(projectId)) {
    return;
  }

  const userResult = await supabase.auth.getUser();
  const userId = userResult.data.user?.id;
  if (!userId) {
    return;
  }

  await syncRequirementSources(supabase, projectId, userId);
  await syncAnalysisItems(supabase, projectId, userId);
  await syncTestCases(supabase, projectId, userId);
  await syncGeneratedAutomations(supabase, projectId, userId);
}

async function syncRequirementSources(supabase: SupabaseClient, projectId: string, ownerId: string) {
  const sources = readJson<RequirementSource[]>(appStorageKeys.requirementSources, []);
  if (!Array.isArray(sources) || sources.length === 0) {
    return;
  }

  const rows = sources.map((source) => ({
    ...(isUuid(source.id) ? { id: source.id } : {}),
    project_id: projectId,
    owner_id: ownerId,
    file_name: source.fileName || "Requirement source",
    source_type: source.sourceType || "Manual Paste",
    file_type: source.fileType || "text/plain",
    file_size: source.fileSize || source.extractedText?.length || 0,
    storage_path: source.storagePath,
    extracted_text: source.extractedText || "",
    processing_status: source.processingStatus || "Analysis Ready",
    created_at: source.createdAt || new Date().toISOString()
  }));

  const result = await supabase.from("requirement_sources").upsert(rows, { onConflict: "id" });
  if (result.error) {
    throw new Error(`Failed to sync requirement sources: ${result.error.message}`);
  }
}

async function syncAnalysisItems(supabase: SupabaseClient, projectId: string, ownerId: string) {
  const items = readJson<AnalysisItem[]>(appStorageKeys.analysisItems, []);
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  const rows = items.map((item) => ({
    ...(isUuid(item.id) ? { id: item.id } : {}),
    project_id: projectId,
    owner_id: ownerId,
    ...(isUuid(item.requirementSourceId) ? { requirement_source_id: item.requirementSourceId } : {}),
    item_type: item.itemType,
    title: item.title || "Analysis item",
    description: item.description || "",
    reference_code: item.referenceCode || "AI-UNMAPPED",
    confidence_score: typeof item.confidenceScore === "number" ? item.confidenceScore : 0.75
  }));

  const result = await supabase.from("analysis_items").upsert(rows, { onConflict: "id" });
  if (result.error) {
    throw new Error(`Failed to sync analysis items: ${result.error.message}`);
  }
}

async function syncTestCases(supabase: SupabaseClient, projectId: string, ownerId: string) {
  const testCases = readJson<TestCase[]>(appStorageKeys.testCases, []);
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return;
  }

  const rows = testCases.map((testCase) => {
    const type = normalizeTestType(testCase.testType ?? testCase.type);
    const readiness = normalizeReadiness(testCase.automationStatus ?? testCase.readiness);
    const status = normalizeStatus(testCase.approvalStatus ?? testCase.status);

    return {
      project_id: projectId,
      owner_id: ownerId,
      test_case_id: testCase.testCaseId || testCase.id,
      requirement_reference: testCase.requirementReference,
      name: testCase.name || testCase.title || testCase.testCaseId,
      title: testCase.title || testCase.name || testCase.testCaseId,
      description: testCase.description || "",
      preconditions: testCase.preconditions || "",
      steps: Array.isArray(testCase.steps) ? testCase.steps : [],
      expected_result: testCase.expectedResult || "",
      priority: normalizePriority(testCase.priority),
      type,
      test_type: type,
      automation_candidate: Boolean(testCase.automationCandidate),
      automation_status: readiness,
      automation_notes: testCase.automationNotes || "",
      readiness,
      readiness_confidence: testCase.readinessConfidence,
      readiness_reason: testCase.readinessReason,
      recommended_framework: testCase.recommendedFramework,
      status,
      approval_status: status,
      review_notes: testCase.reviewNotes,
      approved_by: isUuid(testCase.approvedBy) ? testCase.approvedBy : null,
      approved_at: testCase.approvedAt,
      rejected_by: isUuid(testCase.rejectedBy) ? testCase.rejectedBy : null,
      rejected_at: testCase.rejectedAt,
      analysis_item_ids: testCase.analysisItemIds ?? [],
      requirement_source_ids: testCase.requirementSourceIds ?? [],
      updated_at: testCase.updatedAt || new Date().toISOString()
    };
  });

  const result = await supabase.from("test_cases").upsert(rows, { onConflict: "project_id,test_case_id" });
  if (result.error) {
    throw new Error(`Failed to sync test cases: ${result.error.message}`);
  }
}

async function syncGeneratedAutomations(supabase: SupabaseClient, projectId: string, ownerId: string) {
  const scripts = readJson<GeneratedScript[]>(appStorageKeys.generatedAutomations, []);
  if (!Array.isArray(scripts) || scripts.length === 0) {
    return;
  }

  const rows = scripts.map((script) => ({
    ...(isUuid(script.id) ? { id: script.id } : {}),
    project_id: projectId,
    owner_id: ownerId,
    name: script.name || "generated-automation",
    language: script.language || "typescript",
    framework: script.framework || "Playwright",
    generation_type: script.generationType,
    linked_feature_file_name: script.linkedFeatureFileName,
    test_case_ids: script.testCaseIds ?? [],
    code: script.code || "",
    created_at: script.createdAt || new Date().toISOString()
  }));

  const result = await supabase.from("generated_automation").upsert(rows, { onConflict: "id" });
  if (result.error) {
    throw new Error(`Failed to sync generated automation: ${result.error.message}`);
  }
}

function rowToProject(row: Record<string, unknown>): Project {
  return sanitizeProject({
    id: stringValue(row.id),
    name: stringValue(row.name),
    clientName: nullableString(row.client_name),
    applicationName: nullableString(row.application_name),
    releaseName: nullableString(row.release_name),
    description: nullableString(row.description),
    status: (row.status as Project["status"]) ?? "Active",
    created_at: nullableString(row.created_at) ?? undefined,
    updated_at: nullableString(row.updated_at) ?? undefined
  });
}

function rowToRequirementSource(row: Record<string, unknown>): RequirementSource {
  return {
    id: stringValue(row.id),
    projectId: nullableString(row.project_id) ?? undefined,
    fileName: stringValue(row.file_name, "Requirement source"),
    sourceType: row.source_type === "Upload" ? "Upload" : "Manual Paste",
    fileType: stringValue(row.file_type, "text/plain"),
    fileSize: numberValue(row.file_size),
    storagePath: nullableString(row.storage_path) ?? undefined,
    extractedText: stringValue(row.extracted_text),
    processingStatus: row.processing_status === "Failed" ? "Failed" : row.processing_status === "Uploaded" ? "Uploaded" : row.processing_status === "Extracted" ? "Extracted" : "Analysis Ready",
    createdAt: stringValue(row.created_at, new Date().toISOString())
  };
}

function rowToAnalysisItem(row: Record<string, unknown>): AnalysisItem {
  return {
    id: stringValue(row.id),
    requirementSourceId: nullableString(row.requirement_source_id) ?? undefined,
    itemType: row.item_type as AnalysisItem["itemType"],
    title: stringValue(row.title, "Analysis item"),
    description: stringValue(row.description),
    referenceCode: stringValue(row.reference_code, "AI-UNMAPPED"),
    confidenceScore: numberValue(row.confidence_score, 0.75)
  };
}

function rowToTestCase(row: Record<string, unknown>): TestCase {
  const type = normalizeTestType(row.test_type ?? row.type);
  const readiness = normalizeReadiness(row.automation_status ?? row.readiness);
  const status = normalizeStatus(row.approval_status ?? row.status);

  return {
    id: stringValue(row.id),
    testCaseId: stringValue(row.test_case_id, "QA-TC-001"),
    name: stringValue(row.name ?? row.title, "Generated test case"),
    title: stringValue(row.title ?? row.name, "Generated test case"),
    description: stringValue(row.description),
    preconditions: stringValue(row.preconditions),
    steps: Array.isArray(row.steps) ? row.steps.map(String) : [],
    expectedResult: stringValue(row.expected_result),
    priority: normalizePriority(row.priority),
    type,
    testType: type,
    requirementReference: stringValue(row.requirement_reference, "UNMAPPED"),
    automationCandidate: Boolean(row.automation_candidate),
    automationNotes: stringValue(row.automation_notes),
    readiness,
    automationStatus: readiness,
    readinessConfidence: optionalNumber(row.readiness_confidence),
    readinessReason: nullableString(row.readiness_reason) ?? undefined,
    recommendedFramework: frameworks.includes(row.recommended_framework as RecommendedFramework) ? (row.recommended_framework as RecommendedFramework) : undefined,
    status,
    approvalStatus: status,
    reviewNotes: nullableString(row.review_notes) ?? undefined,
    approvedBy: nullableString(row.approved_by) ?? undefined,
    approvedAt: nullableString(row.approved_at) ?? undefined,
    rejectedBy: nullableString(row.rejected_by) ?? undefined,
    rejectedAt: nullableString(row.rejected_at) ?? undefined,
    updatedAt: nullableString(row.updated_at) ?? undefined,
    analysisItemIds: Array.isArray(row.analysis_item_ids) ? row.analysis_item_ids.map(String) : [],
    requirementSourceIds: Array.isArray(row.requirement_source_ids) ? row.requirement_source_ids.map(String) : []
  };
}

function rowToAutomationAssessment(row: Record<string, unknown>): AutomationAssessment {
  return {
    id: stringValue(row.id),
    testCaseId: stringValue(row.test_case_id),
    readiness: normalizeReadiness(row.readiness),
    confidenceScore: numberValue(row.confidence_score, 0.85),
    reason: stringValue(row.reason ?? row.notes),
    recommendedFramework: frameworks.includes(row.recommended_framework as RecommendedFramework) ? (row.recommended_framework as RecommendedFramework) : "Playwright"
  };
}

function rowToGeneratedScript(row: Record<string, unknown>): GeneratedScript {
  return {
    id: stringValue(row.id),
    testCaseIds: Array.isArray(row.test_case_ids) ? row.test_case_ids.map(String) : [],
    name: stringValue(row.name, "generated-automation"),
    code: stringValue(row.code),
    createdAt: stringValue(row.created_at, new Date().toISOString()),
    language: row.language === "python" || row.language === "gherkin" ? row.language : "typescript",
    framework: row.framework === "Playwright Python" || row.framework === "Gherkin Feature" ? row.framework : "Playwright",
    generationType: row.generation_type as GeneratedScript["generationType"],
    linkedFeatureFileName: nullableString(row.linked_feature_file_name) ?? undefined
  };
}

function sourceToDocument(source: RequirementSource): UploadedDocument {
  return {
    id: source.id,
    projectId: source.projectId,
    fileName: source.fileName,
    fileType: source.fileType,
    fileSize: source.fileSize,
    storagePath: source.storagePath,
    extractedText: source.extractedText,
    createdAt: source.createdAt,
    processingStatus: source.processingStatus
  };
}

function normalizePriority(value: unknown): Priority {
  return priorities.includes(value as Priority) ? (value as Priority) : "Medium";
}

function normalizeTestType(value: unknown): TestCaseType {
  return testTypes.includes(value as TestCaseType) ? (value as TestCaseType) : "Functional";
}

function normalizeReadiness(value: unknown): AutomationReadiness {
  return readinessValues.includes(value as AutomationReadiness) ? (value as AutomationReadiness) : "Manual Only";
}

function normalizeStatus(value: unknown): TestCaseStatus {
  return statuses.includes(value as TestCaseStatus) ? (value as TestCaseStatus) : "Draft";
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalNumber(value: unknown) {
  const number = numberValue(value, Number.NaN);
  return Number.isFinite(number) ? number : undefined;
}
