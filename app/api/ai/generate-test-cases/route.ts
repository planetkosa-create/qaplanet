import { NextResponse } from "next/server";
import { buildTestCasePrompt, getOpenAIClient, safeJsonParse } from "@/lib/ai";
import { sampleTestCases } from "@/lib/sample-data";
import type { RequirementAnalysis, TestCase } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResponseShape = {
  testCases: Array<Omit<TestCase, "id" | "status"> & { id?: string; status?: TestCase["status"] }>;
};

export async function POST(request: Request) {
  const { requirements, analysis } = (await request.json()) as {
    requirements?: string;
    analysis?: RequirementAnalysis;
  };

  if (!requirements?.trim() || !analysis) {
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
      { role: "user", content: buildTestCasePrompt(requirements, analysis) }
    ],
    temperature: 0.25
  });

  const content = completion.choices[0]?.message.content ?? "{}";
  const parsed = safeJsonParse<ResponseShape>(content, { testCases: sampleTestCases });
  const testCases: TestCase[] = parsed.testCases.map((testCase, index) => ({
    ...testCase,
    id: testCase.id ?? crypto.randomUUID(),
    testCaseId: testCase.testCaseId || `QA-TC-${String(index + 1).padStart(3, "0")}`,
    status: testCase.status ?? "Draft"
  }));

  return NextResponse.json({ testCases });
}
