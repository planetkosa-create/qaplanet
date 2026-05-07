import { NextResponse } from "next/server";
import { buildAnalysisPrompt, getOpenAIClient, safeJsonParse } from "@/lib/ai";
import { sampleAnalysis } from "@/lib/sample-data";
import type { RequirementAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { requirements } = (await request.json()) as { requirements?: string };

  if (!requirements?.trim()) {
    return NextResponse.json({ error: "Requirements text is required." }, { status: 400 });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured.", analysis: sampleAnalysis }, { status: 503 });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You produce strict JSON for enterprise QA analysis." },
      { role: "user", content: buildAnalysisPrompt(requirements) }
    ],
    temperature: 0.2
  });

  const content = completion.choices[0]?.message.content ?? "{}";
  const analysis = safeJsonParse<RequirementAnalysis>(content, sampleAnalysis);

  return NextResponse.json({ analysis });
}
