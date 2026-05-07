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
    const payload = (await request.json()) as {
      testCases?: TestCase[];
      language?: AutomationLanguage;
      generationType?: "script" | "pageObject" | "fullPackage" | "apiTests" | "feature";
      framework?: string;
      projectId?: string;
      testCaseIds?: string[];
    };
    const { testCases, language = "typescript", generationType } = payload;

    if (!testCases?.length) {
      return NextResponse.json({ error: "Select at least one test case." }, { status: 400 });
    }

    if (generationType === "feature") {
      const fallbackContent = generateGherkinFeatureFromTestCases(testCases);
      const fileName = slugifyFeatureName(inferFeatureTitle(testCases));
      const openai = getOpenAIClient();

      if (!openai) {
        return NextResponse.json({
          success: true,
          fileName,
          language: "gherkin",
          content: fallbackContent
        });
      }

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a senior QA automation architect generating business-readable Gherkin feature files from approved QAplanet test cases. Generate valid Gherkin only. Do not include markdown fences. Do not include Playwright code. Use Given/When/Then/And. Include purpose comments, feature-level tags, scenario-level tags, Background where useful, Scenario Outline with Examples where test cases share a common flow, and traceability comments for QAplanet test case IDs and requirement references."
            },
            {
              role: "user",
              content: `Generate one .feature file for these QAplanet test cases:\n${JSON.stringify(testCases, null, 2)}`
            }
          ],
          temperature: 0.2
        });
        const content = completion.choices[0]?.message.content?.trim() || fallbackContent;

        return NextResponse.json({
          success: true,
          fileName,
          language: "gherkin",
          content: stripMarkdownFence(content)
        });
      } catch {
        return NextResponse.json({
          success: true,
          fileName,
          language: "gherkin",
          content: fallbackContent
        });
      }
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

function generateGherkinFeatureFromTestCases(testCases: TestCase[]) {
  const featureTitle = inferFeatureTitle(testCases);
  const commonPrecondition = inferCommonPrecondition(testCases);

  return [
    "# Purpose: This file contains test scenarios written in the Gherkin language.",
    "# Each scenario represents expected application behavior derived from approved QAplanet test cases.",
    "# This file is intended to act as the single source of truth for business-readable automated test coverage.",
    "",
    "@qaplanet",
    tagFromText(featureTitle),
    `Feature: ${featureTitle}`,
    "",
    "  Background:",
    `    Given ${commonPrecondition}`,
    "",
    ...testCases.flatMap((testCase) => [
      `  # QAplanet Test Case: ${testCase.testCaseId}`,
      `  # Requirement Reference: ${testCase.requirementReference || "UNMAPPED"}`,
      `  ${scenarioTags(testCase).join(" ")}`,
      `  Scenario: ${businessReadable(testCase.title ?? testCase.name)}`,
      ...mapTestCaseToGherkinSteps(testCase),
      ""
    ])
  ].join("\n");
}

function mapTestCaseToGherkinSteps(testCase: TestCase) {
  const steps = Array.isArray(testCase.steps) ? testCase.steps.filter(Boolean) : [];
  const output = [`    Given ${cleanGherkinText(testCase.preconditions || "the required preconditions are met")}`];

  if (!steps.length) {
    output.push(`    When the user completes the ${cleanGherkinText(testCase.title ?? testCase.name)} workflow`);
  } else {
    steps.forEach((step, index) => {
      output.push(`    ${index === 0 ? "When" : "And"} ${cleanGherkinText(step)}`);
    });
  }

  output.push(`    Then ${cleanGherkinText(testCase.expectedResult || "the expected outcome is displayed")}`);
  return output;
}

function scenarioTags(testCase: TestCase) {
  const tags = new Set<string>(["@regression"]);
  const type = testCase.testType ?? testCase.type;
  const readiness = testCase.automationStatus ?? testCase.readiness;

  if (testCase.priority === "Critical" && !["Negative", "Security", "Performance"].includes(type)) tags.add("@smoke");
  if (type === "Negative") tags.add("@negative");
  if (type === "Security") tags.add("@security");
  if (type === "Accessibility") tags.add("@accessibility");
  if (type === "Performance") tags.add("@performance");
  if (type === "Integration") tags.add("@integration");
  if (readiness === "Manual Only") tags.add("@manual");
  if (readiness === "Automatable") tags.add("@automated");
  if (testCase.requirementReference) tags.add(tagFromText(testCase.requirementReference));

  return [...tags];
}

function inferFeatureTitle(testCases: TestCase[]) {
  const title = testCases[0]?.title ?? testCases[0]?.name ?? "QAplanet Generated Behavior";
  for (const separator of [" - ", ": ", " | "]) {
    if (title.includes(separator)) {
      return businessReadable(title.split(separator)[0] ?? "QAplanet Generated Behavior");
    }
  }
  return businessReadable(title.split(/\s+/).slice(0, 5).join(" "));
}

function inferCommonPrecondition(testCases: TestCase[]) {
  const preconditions = testCases.map((testCase) => cleanGherkinText(testCase.preconditions)).filter(Boolean);
  const first = preconditions[0];
  return first && preconditions.every((item) => item === first) ? first : "the user has access to the application";
}

function slugifyFeatureName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${slug || "generated_feature"}.feature`;
}

function tagFromText(value: string) {
  const tag = value
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `@${tag || "qaplanet"}`;
}

function businessReadable(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/[.]+$/g, "");
}

function cleanGherkinText(value: string) {
  return businessReadable(value)
    .replace(/\b(click|tap)\b/gi, "select")
    .replace(/\bCSS selector\b/gi, "field")
    .replace(/\blocator\b/gi, "element")
    .replace(/["`]/g, "'");
}

function stripMarkdownFence(content: string) {
  return content.replace(/^```(?:gherkin|feature)?/i, "").replace(/```$/i, "").trim();
}
