import { NextResponse } from "next/server";
import { buildAnalysisItemsPrompt, buildAnalysisPrompt, getOpenAIClient, safeJsonParse } from "@/lib/ai";
import { sampleAnalysis } from "@/lib/sample-data";
import { sampleAnalysisItems } from "@/lib/phase2-sample-data";
import type { AnalysisItem, RequirementAnalysis, RequirementSource } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { requirements, sources } = (await request.json()) as {
      requirements?: string;
      sources?: RequirementSource[];
    };
    const hasSources = Boolean(sources?.length);
    const text = requirements ?? sources?.map((source) => source.extractedText).join("\n\n");

    if (!text?.trim()) {
      return NextResponse.json({ error: "Requirements text is required." }, { status: 400 });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured.", analysis: sampleAnalysis, analysisItems: sampleAnalysisItems },
        { status: 503 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You produce strict JSON for enterprise QA analysis." },
        { role: "user", content: hasSources ? buildAnalysisItemsPrompt(sources ?? []) : buildAnalysisPrompt(text) }
      ],
      temperature: 0.2
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    if (hasSources) {
      const parsed = safeJsonParse<{ summary: string; analysisItems: Array<Omit<AnalysisItem, "id"> & { id?: string }> }>(
        content,
        { summary: sampleAnalysis.summary, analysisItems: sampleAnalysisItems }
      );
      const analysisItems: AnalysisItem[] = parsed.analysisItems.map((item) => ({
        ...item,
        id: item.id ?? crypto.randomUUID(),
        confidenceScore: Number(item.confidenceScore ?? 0.75)
      }));
      return NextResponse.json({ summary: parsed.summary, analysisItems });
    }

    const analysis = safeJsonParse<RequirementAnalysis>(content, sampleAnalysis);

    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
