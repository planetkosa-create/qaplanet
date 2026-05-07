import { NextResponse } from "next/server";
import { buildPhase2TestCasePrompt, buildTestCasePrompt, getOpenAIClient, safeJsonParse } from "@/lib/ai";
import { sampleTestCases } from "@/lib/sample-data";
import type { AnalysisItem, RequirementAnalysis, RequirementSource, TestCase } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResponseShape = {
  testCases: Array<Omit<TestCase, "id" | "status"> & { id?: string; status?: TestCase["status"] }>;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      requirements?: string;
      analysis?: RequirementAnalysis;
      analysisItems?: AnalysisItem[];
      sources?: RequirementSource[];
    };
    const { requirements, analysis } = payload;
    const phase2 = Boolean(payload.analysisItems?.length && payload.sources?.length);

    if (!phase2 && (!requirements?.trim() || !analysis)) {
      return NextResponse.json({ error: "Requirements and analysis are required." }, { status: 400 });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured.", testCases: sampleTestCases }, { status: 503 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You produce strict JSON for enterprise QA test case generation." },
        {
          role: "user",
          content: phase2
            ? buildPhase2TestCasePrompt(payload.sources ?? [], payload.analysisItems ?? [])
            : buildTestCasePrompt(requirements ?? "", analysis as RequirementAnalysis)
        }
      ],
      temperature: 0.25
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = safeJsonParse<ResponseShape>(content, { testCases: sampleTestCases });
    const testCases: TestCase[] = parsed.testCases.map((testCase, index) => ({
      ...testCase,
      id: testCase.id ?? crypto.randomUUID(),
      testCaseId: testCase.testCaseId || `QA-TC-${String(index + 1).padStart(3, "0")}`,
      name: testCase.name || testCase.title || `Generated test case ${index + 1}`,
      title: testCase.title || testCase.name,
      type: testCase.type,
      testType: testCase.testType ?? testCase.type,
      readiness: testCase.readiness ?? testCase.automationStatus ?? "Manual Only",
      automationStatus: testCase.automationStatus ?? testCase.readiness ?? "Manual Only",
      status: testCase.status ?? testCase.approvalStatus ?? "Draft",
      approvalStatus: testCase.approvalStatus ?? testCase.status ?? "Draft"
    }));

    return NextResponse.json({ testCases });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test case generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
