import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPhase2TestCasePrompt, buildTestCasePrompt, getOpenAIClient, safeJsonParse } from "@/lib/ai";
import { sampleTestCases } from "@/lib/sample-data";
import type { AnalysisItem, AutomationReadiness, Priority, RequirementAnalysis, RequirementSource, TestCase, TestCaseStatus, TestCaseType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResponseShape = {
  testCases?: RawTestCase[];
  test_cases?: RawTestCase[];
  generatedTestCases?: RawTestCase[];
};

type RawTestCase = Partial<TestCase> & {
  test_case_id?: string;
  requirement_reference?: string;
  expected_result?: string;
  test_type?: string;
  automation_candidate?: boolean;
  automation_status?: string;
  automation_notes?: string;
  approval_status?: string;
  analysis_item_ids?: string[];
  requirement_source_ids?: string[];
};

type GeneratedTestCase = {
  test_case_id: string;
  requirement_reference: string;
  title: string;
  description: string;
  preconditions: string;
  steps: string[];
  expected_result: string;
  priority: Priority;
  test_type: Exclude<TestCaseType, "Validation" | "Role-based">;
  automation_candidate: boolean;
  automation_status: AutomationReadiness;
  automation_notes: string;
  approval_status: TestCaseStatus;
  analysis_item_ids: string[];
  requirement_source_ids: string[];
};

const testCaseBatches = [
  {
    name: "Batch 1: Registration, Login, Role-based access",
    focus: ["Registration validation", "Login and account lockout", "Role-based access control"],
    minimumCount: 7
  },
  {
    name: "Batch 2: Application form, Draft, Uploads, Submission",
    focus: [
      "Draft creation and duplicate draft prevention",
      "Required field validation",
      "Application save and resume",
      "Document upload validation",
      "Required document enforcement",
      "Application submission",
      "Read-only submitted applications"
    ],
    minimumCount: 8
  },
  {
    name: "Batch 3: Status, Withdrawal, Reviewer queue, Reviewer updates",
    focus: ["Application status visibility", "Withdrawal rules", "Reviewer queue filtering and sorting", "Reviewer status updates"],
    minimumCount: 6
  },
  {
    name: "Batch 4: Admin config, Audit, Notifications, Accessibility, Performance, Security",
    focus: ["Administrator configuration", "Audit history", "Notification triggers", "Accessibility checks", "Performance checks", "Security checks"],
    minimumCount: 8
  }
];

const priorities: Priority[] = ["Critical", "High", "Medium", "Low"];
const types: TestCaseType[] = ["Functional", "Negative", "Edge", "Security", "Integration", "Accessibility", "Performance", "Regression"];
const readinessValues: AutomationReadiness[] = ["Automatable", "Needs API/Data", "Manual Only"];
const statuses: TestCaseStatus[] = ["Draft", "Approved", "Rejected"];

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      requirements?: string;
      analysis?: RequirementAnalysis;
      analysisItems?: AnalysisItem[];
      sources?: RequirementSource[];
      projectId?: string;
      generationMode?: "replace" | "append";
      accessToken?: string;
      startNumber?: number;
    };
    const { requirements, analysis } = payload;
    const phase2 = Boolean(payload.analysisItems?.length && payload.sources?.length);
    console.log("[QAplanet] Test case generation started");
    console.log(`[QAplanet] Requirement sources found: ${payload.sources?.length ?? 0}`);
    console.log(`[QAplanet] Analysis items found: ${payload.analysisItems?.length ?? 0}`);

    if (!phase2 && (!requirements?.trim() || !analysis)) {
      return NextResponse.json({ success: false, error: "Requirements and analysis are required." }, { status: 400 });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ success: false, error: "OPENAI_API_KEY is not configured.", test_cases: sampleTestCases }, { status: 503 });
    }

    const rawPayloads: unknown[] = [];

    if (phase2) {
      let startNumber = payload.startNumber ?? 1;
      for (const batch of testCaseBatches) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You produce strict JSON only for enterprise QA test case generation. Never return markdown. Never summarize instead of generating test cases."
            },
            {
              role: "user",
              content: buildPhase2TestCasePrompt(payload.sources ?? [], payload.analysisItems ?? [], {
                batchName: batch.name,
                coverageFocus: batch.focus,
                startNumber,
                minimumCount: batch.minimumCount
              })
            }
          ],
          temperature: 0.2
        });

        const content = completion.choices[0]?.message.content ?? "{}";
        console.log(`[QAplanet] Raw OpenAI response length (${batch.name}): ${content.length}`);
        const parsed = safeJsonParse<ResponseShape>(content, { test_cases: [] });
        const batchCases = normalizeGeneratedTestCases(parsed);
        rawPayloads.push(...batchCases);
        console.log(`[QAplanet] Parsed test case count (${batch.name}): ${batchCases.length}`);
        startNumber += Math.max(batchCases.length, batch.minimumCount);
      }

      if (rawPayloads.length < 25) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You produce strict JSON only. Fill missing enterprise QA coverage with additional non-duplicate test cases."
            },
            {
              role: "user",
              content: buildPhase2TestCasePrompt(payload.sources ?? [], payload.analysisItems ?? [], {
                batchName: "Coverage gap fill: generate additional non-duplicate test cases",
                coverageFocus: testCaseBatches.flatMap((batch) => batch.focus),
                startNumber,
                minimumCount: 25 - rawPayloads.length
              })
            }
          ],
          temperature: 0.2
        });

        const content = completion.choices[0]?.message.content ?? "{}";
        console.log(`[QAplanet] Raw OpenAI response length (coverage gap fill): ${content.length}`);
        const parsed = safeJsonParse<ResponseShape>(content, { test_cases: [] });
        const gapCases = normalizeGeneratedTestCases(parsed);
        rawPayloads.push(...gapCases);
        console.log(`[QAplanet] Parsed test case count (coverage gap fill): ${gapCases.length}`);
      }
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You produce strict JSON for enterprise QA test case generation." },
          { role: "user", content: buildTestCasePrompt(requirements ?? "", analysis as RequirementAnalysis) }
        ],
        temperature: 0.25
      });

      const content = completion.choices[0]?.message.content ?? "{}";
      console.log(`[QAplanet] Raw OpenAI response length: ${content.length}`);
      const parsed = safeJsonParse<ResponseShape>(content, { testCases: sampleTestCases });
      const generated = normalizeGeneratedTestCases(parsed);
      rawPayloads.push(...generated);
      console.log(`[QAplanet] Parsed test case count: ${generated.length}`);
    }

    const normalized = normalizeGeneratedTestCases(rawPayloads);
    const testCases = normalizeTestCases(dedupeGeneratedTestCases(normalized), payload.startNumber ?? 1);
    console.log(`[QAplanet] Parsed test case count (merged): ${testCases.length}`);

    if (testCases.length === 0) {
      throw new Error("No test cases were returned. Please confirm AI analysis exists and the requirement source contains extracted text.");
    }

    const insertedTestCases = await saveGeneratedTestCases({
      testCases,
      projectId: payload.projectId,
      generationMode: payload.generationMode ?? "replace",
      accessToken: payload.accessToken
    });

    return NextResponse.json({
      success: true,
      count: insertedTestCases.length,
      test_cases: insertedTestCases,
      testCases: insertedTestCases
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test case generation failed.";
    console.error("[QAplanet] Failed to generate test cases:", message);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate test cases"
      },
      { status: 500 }
    );
  }
}

function normalizeGeneratedTestCases(payload: unknown): GeneratedTestCase[] {
  const raw = payload as { test_cases?: unknown; testCases?: unknown; generatedTestCases?: unknown } | unknown[];

  const cases = Array.isArray((raw as { test_cases?: unknown }).test_cases)
    ? (raw as { test_cases: unknown[] }).test_cases
    : Array.isArray((raw as { testCases?: unknown }).testCases)
      ? (raw as { testCases: unknown[] }).testCases
      : Array.isArray((raw as { generatedTestCases?: unknown }).generatedTestCases)
        ? (raw as { generatedTestCases: unknown[] }).generatedTestCases
        : Array.isArray(raw)
          ? raw
          : [];

  return cases.map((item: unknown, index: number) => {
    const record = item as RawTestCase;
    const status = normalizeStatus(record.approval_status ?? record.approvalStatus ?? record.status);
    const testType = normalizeType(record.test_type ?? record.testType ?? record.type) as GeneratedTestCase["test_type"];
    const automationStatus = normalizeReadiness(record.automation_status ?? record.automationStatus ?? record.readiness);

    return {
      test_case_id: record.test_case_id || record.testCaseId || `QA-TC-${String(index + 1).padStart(3, "0")}`,
      requirement_reference: record.requirement_reference || record.requirementReference || "UNMAPPED",
      title: record.title || record.name || `Generated Test Case ${index + 1}`,
      description: record.description || "",
      preconditions: record.preconditions || "",
      steps: Array.isArray(record.steps) ? record.steps : [],
      expected_result: record.expected_result || record.expectedResult || "",
      priority: normalizePriority(record.priority),
      test_type: testType,
      automation_candidate:
        typeof record.automation_candidate === "boolean"
          ? record.automation_candidate
          : typeof record.automationCandidate === "boolean"
            ? record.automationCandidate
            : automationStatus === "Automatable",
      automation_status: automationStatus,
      automation_notes: record.automation_notes || record.automationNotes || readinessNote(automationStatus),
      approval_status: status,
      analysis_item_ids: record.analysis_item_ids ?? record.analysisItemIds ?? [],
      requirement_source_ids: record.requirement_source_ids ?? record.requirementSourceIds ?? []
    };
  });
}

function dedupeGeneratedTestCases(rawCases: GeneratedTestCase[]) {
  const seen = new Set<string>();
  const unique: GeneratedTestCase[] = [];

  for (const testCase of rawCases) {
    const title = testCase.title ?? "";
    const key = `${title.toLowerCase()}|${testCase.requirement_reference ?? ""}`;
    if (!title || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(testCase);
  }

  return unique;
}

function normalizeTestCases(rawCases: GeneratedTestCase[], startNumber: number): TestCase[] {
  return rawCases.map((testCase, index) => {
    const title = testCase.title || `Generated test case ${index + 1}`;
    const type = normalizeType(testCase.test_type);
    const readiness = normalizeReadiness(testCase.automation_status);

    return {
      id: crypto.randomUUID(),
      testCaseId: `QA-TC-${String(startNumber + index).padStart(3, "0")}`,
      name: title,
      title,
      description: testCase.description || `Verify ${title}.`,
      preconditions: testCase.preconditions || "Relevant user, data, roles, and environment configuration are available.",
      steps: Array.isArray(testCase.steps) && testCase.steps.length ? testCase.steps : ["Open the relevant workflow.", "Perform the stated action.", "Review the outcome."],
      expectedResult: testCase.expected_result || "The system behaves according to the requirement.",
      priority: normalizePriority(testCase.priority),
      type,
      testType: type,
      requirementReference: testCase.requirement_reference || "UNMAPPED",
      automationCandidate: testCase.automation_candidate,
      automationNotes: testCase.automation_notes || readinessNote(readiness),
      readiness,
      automationStatus: readiness,
      status: "Draft",
      approvalStatus: "Draft",
      analysisItemIds: testCase.analysis_item_ids,
      requirementSourceIds: testCase.requirement_source_ids
    };
  });
}

async function saveGeneratedTestCases({
  testCases,
  projectId,
  generationMode,
  accessToken
}: {
  testCases: TestCase[];
  projectId?: string;
  generationMode: "replace" | "append";
  accessToken?: string;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!projectId || !accessToken || !supabaseUrl || !supabaseAnonKey) {
    return testCases;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    throw new Error("Sign in before saving generated test cases.");
  }
  const userId = user.data.user.id;

  if (generationMode === "replace") {
    const deleteResult = await supabase.from("test_cases").delete().eq("project_id", projectId);
    if (deleteResult.error) {
      console.error("[QAplanet] Supabase test case delete error:", deleteResult.error.message);
      throw new Error(`Failed to replace existing test cases: ${deleteResult.error.message}`);
    }
  }

  const insertResult = await supabase
    .from("test_cases")
    .insert(
      testCases.map((testCase) => ({
        project_id: projectId,
        owner_id: userId,
        test_case_id: testCase.testCaseId,
        requirement_reference: testCase.requirementReference,
        name: testCase.name,
        title: testCase.title ?? testCase.name,
        description: testCase.description,
        preconditions: testCase.preconditions,
        steps: testCase.steps,
        expected_result: testCase.expectedResult,
        priority: testCase.priority,
        type: testCase.type,
        test_type: testCase.testType ?? testCase.type,
        automation_candidate: testCase.automationCandidate,
        automation_status: testCase.automationStatus ?? testCase.readiness,
        automation_notes: testCase.automationNotes,
        readiness: testCase.readiness,
        status: testCase.status,
        approval_status: testCase.approvalStatus ?? testCase.status,
        analysis_item_ids: testCase.analysisItemIds ?? [],
        requirement_source_ids: testCase.requirementSourceIds ?? []
      }))
    )
    .select("*");

  if (insertResult.error) {
    console.error("[QAplanet] Supabase test case insert error:", insertResult.error.message);
    throw new Error(`Failed to save generated test cases: ${insertResult.error.message}`);
  }

  return Array.isArray(insertResult.data) && insertResult.data.length
    ? insertResult.data.map((row) => rowToTestCase(row as Record<string, unknown>))
    : testCases;
}

function rowToTestCase(row: Record<string, unknown>): TestCase {
  const type = normalizeType(row.test_type ?? row.type);
  const readiness = normalizeReadiness(row.automation_status ?? row.readiness);
  const status = normalizeStatus(row.approval_status ?? row.status);

  return {
    id: String(row.id ?? crypto.randomUUID()),
    testCaseId: String(row.test_case_id ?? "QA-TC-001"),
    name: String(row.name ?? row.title ?? "Generated test case"),
    title: String(row.title ?? row.name ?? "Generated test case"),
    description: String(row.description ?? ""),
    preconditions: String(row.preconditions ?? ""),
    steps: Array.isArray(row.steps) ? row.steps.map(String) : [],
    expectedResult: String(row.expected_result ?? ""),
    priority: normalizePriority(row.priority),
    type,
    testType: type,
    requirementReference: String(row.requirement_reference ?? "UNMAPPED"),
    automationCandidate: Boolean(row.automation_candidate),
    automationNotes: String(row.automation_notes ?? readinessNote(readiness)),
    readiness,
    automationStatus: readiness,
    status,
    approvalStatus: status,
    analysisItemIds: Array.isArray(row.analysis_item_ids) ? row.analysis_item_ids.map(String) : [],
    requirementSourceIds: Array.isArray(row.requirement_source_ids) ? row.requirement_source_ids.map(String) : []
  };
}

function normalizePriority(value: unknown): Priority {
  return priorities.includes(value as Priority) ? (value as Priority) : "Medium";
}

function normalizeType(value: unknown): TestCaseType {
  if (types.includes(value as TestCaseType)) {
    return value as TestCaseType;
  }
  if (value === "Validation") return "Edge";
  if (value === "Role-based") return "Security";
  return "Functional";
}

function normalizeReadiness(value: unknown): AutomationReadiness {
  return readinessValues.includes(value as AutomationReadiness) ? (value as AutomationReadiness) : "Manual Only";
}

function normalizeStatus(value: unknown): TestCaseStatus {
  return statuses.includes(value as TestCaseStatus) ? (value as TestCaseStatus) : "Draft";
}

function readinessNote(readiness: AutomationReadiness) {
  if (readiness === "Automatable") return "Good candidate for Playwright automation with stable selectors and test data.";
  if (readiness === "Needs API/Data") return "Automation is possible after test data, API access, or environment setup is available.";
  return "Manual review is recommended due to human judgment, external dependency, or unstable validation.";
}
