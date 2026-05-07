import { NextResponse } from "next/server";
import { buildAutomationAssessmentPrompt, getOpenAIClient, safeJsonParse } from "@/lib/ai";
import { sampleTestCases } from "@/lib/sample-data";
import type { AutomationReadiness, TestCase } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssessmentResponse = {
  assessments?: RawAssessment[];
  automation_assessments?: RawAssessment[];
};

type RawAssessment = {
  testCaseId?: string;
  test_case_id?: string;
  readiness?: string;
  automationCandidate?: boolean;
  automation_candidate?: boolean;
  notes?: string;
  reason?: string;
};

type NormalizedAssessment = {
  testCaseId: string;
  readiness: AutomationReadiness;
  automationCandidate: boolean;
  notes: string;
};

export async function POST(request: Request) {
  try {
    const { testCases } = (await request.json()) as { testCases?: TestCase[] };

    if (!testCases?.length) {
      return NextResponse.json({ error: "Test cases are required." }, { status: 400 });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured.", testCases: sampleTestCases }, { status: 503 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You produce strict JSON for QA automation readiness assessment." },
        { role: "user", content: buildAutomationAssessmentPrompt(testCases) }
      ],
      temperature: 0.15
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = safeJsonParse<AssessmentResponse>(content, { assessments: [] });
    const assessments = normalizeAssessments(parsed);
    const assessmentById = new Map(assessments.map((assessment) => [assessment.testCaseId, assessment]));

    const nextTestCases = testCases.map((testCase) => {
      const assessment = assessmentById.get(testCase.testCaseId);
      if (!assessment) {
        return testCase;
      }

    return {
      ...testCase,
      readiness: assessment.readiness,
      automationStatus: assessment.readiness,
      automationCandidate: assessment.automationCandidate,
      automationNotes: assessment.notes,
      readinessConfidence: assessment.readiness === "Automatable" ? 0.9 : 0.76,
      readinessReason: assessment.notes,
      recommendedFramework: assessment.readiness === "Manual Only" ? "Manual" : assessment.readiness === "Needs API/Data" ? "API" : "Playwright"
    };
  });

    return NextResponse.json({ testCases: nextTestCases });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation assessment failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeAssessments(payload: unknown): NormalizedAssessment[] {
  const raw = payload as { assessments?: unknown; automation_assessments?: unknown } | unknown[];
  const assessments = Array.isArray((raw as { assessments?: unknown }).assessments)
    ? (raw as { assessments: unknown[] }).assessments
    : Array.isArray((raw as { automation_assessments?: unknown }).automation_assessments)
      ? (raw as { automation_assessments: unknown[] }).automation_assessments
      : Array.isArray(raw)
        ? raw
        : [];

  return assessments.map((item: unknown) => {
    const assessment = item as RawAssessment;
    const readiness = normalizeReadiness(assessment.readiness);
    return {
      testCaseId: assessment.testCaseId || assessment.test_case_id || "",
      readiness,
      automationCandidate:
        typeof assessment.automationCandidate === "boolean"
          ? assessment.automationCandidate
          : typeof assessment.automation_candidate === "boolean"
            ? assessment.automation_candidate
            : readiness === "Automatable",
      notes: assessment.notes || assessment.reason || readinessNote(readiness)
    };
  }).filter((assessment) => assessment.testCaseId);
}

function normalizeReadiness(value: unknown): AutomationReadiness {
  return ["Automatable", "Needs API/Data", "Manual Only"].includes(String(value))
    ? (value as AutomationReadiness)
    : "Manual Only";
}

function readinessNote(readiness: AutomationReadiness) {
  if (readiness === "Automatable") return "Good candidate for Playwright automation with stable selectors and test data.";
  if (readiness === "Needs API/Data") return "Automation is possible after test data, API access, or environment setup is available.";
  return "Manual review is recommended due to human judgment, external dependency, or unstable validation.";
}
