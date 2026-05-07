import { NextResponse } from "next/server";
import { buildAutomationAssessmentPrompt, getOpenAIClient, safeJsonParse } from "@/lib/ai";
import { sampleTestCases } from "@/lib/sample-data";
import type { AutomationReadiness, TestCase } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssessmentResponse = {
  assessments: Array<{
    testCaseId: string;
    readiness: AutomationReadiness;
    automationCandidate: boolean;
    notes: string;
  }>;
};

export async function POST(request: Request) {
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
  const assessmentById = new Map(parsed.assessments.map((assessment) => [assessment.testCaseId, assessment]));

  const nextTestCases = testCases.map((testCase) => {
    const assessment = assessmentById.get(testCase.testCaseId);
    if (!assessment) {
      return testCase;
    }

    return {
      ...testCase,
      readiness: assessment.readiness,
      automationCandidate: assessment.automationCandidate,
      automationNotes: assessment.notes
    };
  });

  return NextResponse.json({ testCases: nextTestCases });
}
