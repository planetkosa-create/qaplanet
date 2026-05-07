import { NextResponse } from "next/server";
import { buildAutomationScriptPrompt, buildScriptPrompt, getOpenAIClient, safeJsonParse } from "@/lib/ai";
import { sampleScript } from "@/lib/sample-data";
import { samplePythonScript } from "@/lib/phase2-sample-data";
import type { AutomationLanguage, GeneratedScript, TestCase } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScriptResponse = {
  fileName: string;
  code: string;
};

export async function POST(request: Request) {
  try {
    const { testCases, language = "typescript" } = (await request.json()) as {
      testCases?: TestCase[];
      language?: AutomationLanguage;
    };

    if (!testCases?.length) {
      return NextResponse.json({ error: "Select at least one test case." }, { status: 400 });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured.", script: language === "python" ? samplePythonScript : sampleScript },
        { status: 503 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You produce strict JSON containing clean Playwright TypeScript code." },
      { role: "user", content: language ? buildAutomationScriptPrompt(testCases, language) : buildScriptPrompt(testCases) }
      ],
      temperature: 0.2
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = safeJsonParse<ScriptResponse>(content, { fileName: sampleScript.name, code: sampleScript.code });
    const script: GeneratedScript = {
      id: crypto.randomUUID(),
      testCaseIds: testCases.map((testCase) => testCase.id),
    name: parsed.fileName || "qaplanet-generated.spec.ts",
    code: parsed.code,
    createdAt: new Date().toISOString(),
    language,
    framework: "Playwright"
  };

    return NextResponse.json({ script });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Script generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
