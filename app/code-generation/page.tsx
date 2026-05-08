"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Clipboard, Download, FileArchive, FileCode2, FileText, Loader2, Play, Save, ServerCog } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getStoredProjectId } from "@/lib/project-context";
import { sampleScript, sampleTestCases } from "@/lib/sample-data";
import { sampleGeneratedAutomations, samplePythonScript } from "@/lib/phase2-sample-data";
import type { AutomationLanguage, GeneratedScript, TestCase } from "@/lib/types";
import { downloadTextFile } from "@/lib/exports";
import { buildPythonBddPackageFiles, generatePythonBddStepDefinitions } from "@/lib/generation/python-bdd";

export default function CodeGenerationPage() {
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [language, setLanguage] = useState<AutomationLanguage>("typescript");
  const [scripts, setScripts] = useState<GeneratedScript[]>(sampleGeneratedAutomations);
  const [activeScript, setActiveScript] = useState<GeneratedScript>({ ...sampleScript, language: "typescript", framework: "Playwright" });
  const [loading, setLoading] = useState(false);
  const [featureLoading, setFeatureLoading] = useState(false);
  const [packageLoading, setPackageLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const cases = readJson(appStorageKeys.testCases, sampleTestCases);
    setTestCases(cases);
    setSelectedIds(readJson(appStorageKeys.selectedTestCases, cases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Automatable").map((testCase) => testCase.id)));
    const storedScripts = readJson(appStorageKeys.generatedAutomations, sampleGeneratedAutomations);
    setScripts(storedScripts);
    setActiveScript(readJson(appStorageKeys.generatedScript, storedScripts[0] ?? { ...sampleScript, language: "typescript", framework: "Playwright" }));
  }, []);

  const selectedTestCases = useMemo(
    () =>
      testCases.filter(
        (testCase) =>
          selectedIds.includes(testCase.id) &&
          (testCase.approvalStatus ?? testCase.status) !== "Rejected" &&
          (testCase.automationStatus ?? testCase.readiness) === "Automatable"
      ),
    [selectedIds, testCases]
  );

  async function generateScript() {
    setLoading(true);
    setMessage("");
    try {
      if (language === "python") {
        const approvedAutomatableCases = getApprovedAutomatableCases(selectedTestCases);

        if (!approvedAutomatableCases.length) {
          throw new Error("Select at least one approved automatable test case before generating Python step definitions.");
        }

        const featureScript = ensureFeatureScriptForCases(approvedAutomatableCases, scripts, activeScript);
        const project = readJson(appStorageKeys.project, { name: "QAplanet" });
        const pythonFile = generatePythonBddStepDefinitions({
          featureFileName: featureScript.name,
          featureContent: featureScript.code,
          projectName: project.name,
          testCases: approvedAutomatableCases
        });
        const nextScript: GeneratedScript = {
          id: crypto.randomUUID(),
          testCaseIds: approvedAutomatableCases.map((testCase) => testCase.id),
          name: pythonFile.fileName,
          code: pythonFile.content,
          createdAt: new Date().toISOString(),
          language: "python",
          framework: "Playwright Python",
          generationType: "pythonBdd",
          linkedFeatureFileName: featureScript.name
        };
        const nextScripts = mergeGeneratedScripts([nextScript, featureScript], scripts);
        setActiveScript(nextScript);
        setScripts(nextScripts);
        writeJson(appStorageKeys.generatedScript, nextScript);
        writeJson(appStorageKeys.generatedAutomations, nextScripts);
        setMessage(`Generated Pytest-BDD step definitions from ${featureScript.name}.`);
        return;
      }

      const response = await fetch("/api/ai/generate-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCases: selectedTestCases, language })
      });
      const data = (await response.json().catch(() => ({}))) as { script?: GeneratedScript; error?: string };

      if (!response.ok || !data.script) {
        setMessage(data.error ?? "Script generation failed. Check OpenAI quota and runtime logs.");
        return;
      }

      const nextScript = data.script;
      const nextScripts = [nextScript, ...scripts.filter((script) => script.id !== nextScript.id)];
      setActiveScript(nextScript);
      setScripts(nextScripts);
      writeJson(appStorageKeys.generatedScript, nextScript);
      writeJson(appStorageKeys.generatedAutomations, nextScripts);
      setMessage(`Generated Playwright ${language === "python" ? "Python" : "TypeScript"} automation.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Script generation failed.";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function generatePageObject() {
    const code = buildPageObject(selectedTestCases);
    const nextScript: GeneratedScript = {
      id: crypto.randomUUID(),
      testCaseIds: selectedTestCases.map((testCase) => testCase.id),
      name: "pages/qaplanet-application.page.ts",
      code,
      createdAt: new Date().toISOString(),
      language: "typescript",
      framework: "Playwright"
    };
    const nextScripts = [nextScript, ...scripts.filter((script) => script.id !== nextScript.id)];
    setActiveScript(nextScript);
    setScripts(nextScripts);
    writeJson(appStorageKeys.generatedScript, nextScript);
    writeJson(appStorageKeys.generatedAutomations, nextScripts);
    setMessage("Generated Playwright Page Object Model file.");
  }

  async function generateFeature() {
    setFeatureLoading(true);
    setMessage("");
    try {
      const approvedAutomatableCases = getApprovedAutomatableCases(selectedTestCases);

      if (!approvedAutomatableCases.length) {
        throw new Error("Select at least one approved automatable test case before generating a feature file.");
      }

      let generatedFeature = generateGherkinFeatureFromTestCases(approvedAutomatableCases);
      let fileName = slugifyFeatureName(inferFeatureTitle(approvedAutomatableCases));

      try {
        const response = await fetch("/api/ai/generate-scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: getStoredProjectId(),
            generationType: "feature",
            framework: "Gherkin",
            testCaseIds: approvedAutomatableCases.map((testCase) => testCase.id),
            testCases: approvedAutomatableCases
          })
        });
        const result = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          fileName?: string;
          language?: AutomationLanguage;
          content?: string;
        };

        if (response.ok && result.success && result.content) {
          generatedFeature = result.content;
          fileName = result.fileName || fileName;
        }
      } catch {
        // Local fallback keeps feature generation available when AI is unavailable.
      }

      const nextScript: GeneratedScript = {
        id: crypto.randomUUID(),
        testCaseIds: approvedAutomatableCases.map((testCase) => testCase.id),
        name: fileName,
        code: generatedFeature,
        createdAt: new Date().toISOString(),
        language: "gherkin",
        framework: "Gherkin Feature",
        generationType: "feature"
      };
      const nextScripts = mergeGeneratedScripts([nextScript], scripts);
      setActiveScript(nextScript);
      setScripts(nextScripts);
      writeJson(appStorageKeys.generatedScript, nextScript);
      writeJson(appStorageKeys.generatedAutomations, nextScripts);
      setMessage("Generated Gherkin feature file from approved automatable test cases.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Feature file generation failed.");
    } finally {
      setFeatureLoading(false);
    }
  }

  async function downloadFullPackage() {
    setPackageLoading(true);
    setMessage("");
    try {
      if (language === "python") {
        const approvedAutomatableCases = getApprovedAutomatableCases(selectedTestCases);

        if (!approvedAutomatableCases.length) {
          throw new Error("Select at least one approved automatable test case before generating a Python BDD package.");
        }

        const featureScript = ensureFeatureScriptForCases(approvedAutomatableCases, scripts, activeScript);
        const project = readJson(appStorageKeys.project, { name: "QAplanet" });
        const packageFiles = buildPythonBddPackageFiles({
          featureFileName: featureScript.name,
          featureContent: featureScript.code,
          projectName: project.name,
          testCases: approvedAutomatableCases
        });
        const zip = new JSZip();
        const root = zip.folder("qaplanet-python-bdd-package");
        if (!root) {
          throw new Error("Could not create Python BDD package.");
        }

        root.file(`features/${packageFiles.featureFileName}`, packageFiles.featureContent);
        root.file(`steps/${packageFiles.stepsFile.fileName}`, packageFiles.stepsFile.content);
        root.file(`pages/${packageFiles.pageObjectFileName}`, packageFiles.pageObjectContent);
        root.file(`data/${packageFiles.testDataFileName}`, packageFiles.testDataContent);
        root.file("utils/config_loader.py", packageFiles.configLoaderContent);
        root.file("utils/step_logger.py", packageFiles.stepLoggerContent);
        root.file("pytest.ini", packageFiles.pytestIniContent);
        root.file("requirements.txt", packageFiles.requirementsContent);
        root.file("README.md", packageFiles.readmeContent);

        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, "qaplanet-python-bdd-package.zip");
        const generatedStepScript: GeneratedScript = {
          id: crypto.randomUUID(),
          testCaseIds: approvedAutomatableCases.map((testCase) => testCase.id),
          name: packageFiles.stepsFile.fileName,
          code: packageFiles.stepsFile.content,
          createdAt: new Date().toISOString(),
          language: "python",
          framework: "Playwright Python",
          generationType: "pythonBdd",
          linkedFeatureFileName: featureScript.name
        };
        const nextScripts = mergeGeneratedScripts([generatedStepScript, featureScript], scripts);
        setActiveScript(generatedStepScript);
        setScripts(nextScripts);
        writeJson(appStorageKeys.generatedScript, generatedStepScript);
        writeJson(appStorageKeys.generatedAutomations, nextScripts);
        setMessage("Full Pytest-BDD Playwright Python package downloaded.");
        return;
      }

      const zip = new JSZip();
      const root = zip.folder("qaplanet-playwright-package");
      if (!root) {
        throw new Error("Could not create Playwright package.");
      }

      const scriptCode = activeScript.code || buildSpecFile(selectedTestCases);
      const featureCode = generateGherkinFeatureFromTestCases(
        selectedTestCases.filter((testCase) => (testCase.approvalStatus ?? testCase.status) === "Approved")
      );
      root.file("package.json", buildPackageJson());
      root.file("playwright.config.ts", buildPlaywrightConfig());
      root.file("README.md", buildPackageReadme(selectedTestCases));
      root.file("tests/qaplanet-generated.spec.ts", scriptCode);
      root.file("features/qaplanet-generated.feature", featureCode);
      root.file("pages/qaplanet-application.page.ts", buildPageObject(selectedTestCases));
      root.file("data/qaplanet-test-data.ts", buildTestData(selectedTestCases));
      root.file("utils/env.ts", buildEnvHelper());

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "qaplanet-playwright-package.zip");
      setMessage("Full Playwright package downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Playwright package generation failed.");
    } finally {
      setPackageLoading(false);
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(activeScript.code);
    setMessage("Code copied to clipboard.");
  }

  async function saveScript() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Script saved locally. Configure Supabase to persist generated automation.");
      return;
    }
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      setMessage("Sign in before saving generated automation to Supabase.");
      return;
    }
    const ownerId = user.data.user.id;
    const projectId = getStoredProjectId();

    await supabase.from("generated_automation").insert({
      ...(projectId ? { project_id: projectId } : {}),
      owner_id: ownerId,
      name: activeScript.name,
      language: activeScript.language ?? language,
      framework: activeScript.framework ?? (activeScript.language === "gherkin" ? "Gherkin Feature" : "Playwright"),
      generation_type:
        activeScript.generationType === "pythonBdd"
          ? "Python BDD Step Definitions"
          : activeScript.generationType === "feature"
            ? "Gherkin Feature"
            : activeScript.generationType ?? "script",
      linked_feature_file_name: activeScript.linkedFeatureFileName ?? null,
      test_case_ids: activeScript.testCaseIds,
      code: activeScript.code
    });
    setMessage("Generated automation saved.");
  }

  const fileName = activeScript.name || (language === "python" ? "qaplanet-generated.spec.py" : "qaplanet-generated.spec.ts");

  return (
    <AppShell>
      <PageHeader
        title="Code Generation"
        description="Generate Playwright TypeScript or Python automation for selected automatable test cases using environment placeholders and accessible locator guidance."
        actions={
          <>
            <select className="focus-ring min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" value={language} onChange={(event) => setLanguage(event.target.value as AutomationLanguage)}>
              <option value="typescript">Playwright TypeScript</option>
              <option value="python">Playwright Python</option>
            </select>
            <Button onClick={generateScript} disabled={loading || selectedTestCases.length === 0} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}>
              Generate Script
            </Button>
            <Button variant="secondary" disabled={selectedTestCases.length === 0} onClick={generatePageObject} icon={<FileCode2 className="size-4" aria-hidden />}>
              Generate Page Object
            </Button>
            <Button variant="secondary" disabled={featureLoading} onClick={generateFeature} icon={featureLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}>
              {featureLoading ? "Generating Feature" : "Generate Feature"}
            </Button>
            <Button variant="secondary" disabled={packageLoading} onClick={downloadFullPackage} icon={packageLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileArchive className="size-4" aria-hidden />}>
              {packageLoading ? "Preparing ZIP" : "Generate Full Package"}
            </Button>
            <Button variant="secondary" disabled icon={<ServerCog className="size-4" aria-hidden />}>Generate API Tests</Button>
            <Button variant="secondary" onClick={copyCode} icon={<Clipboard className="size-4" aria-hidden />}>Copy</Button>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-950">Selectable Approved Automatable Cases</h2>
              <Badge tone="blue">{selectedTestCases.length} ready</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {selectedTestCases.length ? (
                selectedTestCases.map((testCase) => (
                  <div key={testCase.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-sm font-semibold text-slate-950"><span className="whitespace-nowrap text-brand-blue">{testCase.testCaseId}</span>: {testCase.title ?? testCase.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{testCase.automationNotes}</p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No selected automatable cases"
                  description="Select automatable test cases before generating scripts."
                  action={<Link href="/automation-readiness"><Button variant="secondary">Select Cases</Button></Link>}
                />
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Saved Scripts</h2>
            <div className="mt-4 space-y-2">
              {scripts.map((script) => (
                <button
                  key={script.id}
                  className="focus-ring flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => setActiveScript(script)}
                >
                  <span className="font-semibold text-slate-800">{script.name}</span>
                  <Badge>{script.language ?? "typescript"}</Badge>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{fileName}</h2>
              <p className="text-sm text-slate-500">
                {activeScript.language === "gherkin"
                  ? "Gherkin Feature"
                  : activeScript.framework === "Playwright Python"
                    ? "Pytest-BDD + Playwright Python"
                    : `Playwright ${activeScript.language === "python" ? "Python" : "TypeScript"}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={saveScript} icon={<Save className="size-4" aria-hidden />}>Save Script</Button>
              <Button variant="secondary" onClick={downloadFullPackage} disabled={packageLoading} icon={packageLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileArchive className="size-4" aria-hidden />}>Download ZIP</Button>
              <Button
                variant="secondary"
                onClick={() => downloadTextFile(fileName, activeScript.code, mimeTypeForScript(activeScript.language))}
                icon={<Download className="size-4" aria-hidden />}
              >
                Download
              </Button>
            </div>
          </div>
          <pre className="max-h-[700px] overflow-auto bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-100">
            <code>{activeScript.language === "python" && !activeScript.code ? samplePythonScript.code : activeScript.code}</code>
          </pre>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
    </AppShell>
  );
}

function getApprovedAutomatableCases(testCases: TestCase[]) {
  return testCases.filter(
    (testCase) =>
      (testCase.approvalStatus ?? testCase.status) === "Approved" &&
      (testCase.automationStatus ?? testCase.readiness) === "Automatable"
  );
}

function ensureFeatureScriptForCases(testCases: TestCase[], scripts: GeneratedScript[], activeScript: GeneratedScript) {
  const selectedIds = new Set(testCases.map((testCase) => testCase.id));
  const matchingFeature =
    activeScript.language === "gherkin" && overlapsTestCases(activeScript, selectedIds)
      ? activeScript
      : scripts.find((script) => script.language === "gherkin" && overlapsTestCases(script, selectedIds));

  if (matchingFeature) {
    return matchingFeature;
  }

  const featureTitle = inferFeatureTitle(testCases);

  return {
    id: crypto.randomUUID(),
    testCaseIds: testCases.map((testCase) => testCase.id),
    name: slugifyFeatureName(featureTitle),
    code: generateGherkinFeatureFromTestCases(testCases),
    createdAt: new Date().toISOString(),
    language: "gherkin",
    framework: "Gherkin Feature",
    generationType: "feature"
  } satisfies GeneratedScript;
}

function overlapsTestCases(script: GeneratedScript, selectedIds: Set<string>) {
  if (!script.testCaseIds.length || !selectedIds.size) {
    return false;
  }
  return script.testCaseIds.some((id) => selectedIds.has(id));
}

function mergeGeneratedScripts(newScripts: GeneratedScript[], existingScripts: GeneratedScript[]) {
  const seen = new Set<string>();
  const merged: GeneratedScript[] = [];

  [...newScripts, ...existingScripts].forEach((script) => {
    const key = `${script.language ?? "typescript"}:${script.name}:${script.testCaseIds.join("|")}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(script);
  });

  return merged;
}

function buildSpecFile(testCases: TestCase[]) {
  const cases = testCases.length ? testCases : [];
  return `import { test, expect } from "@playwright/test";
import { QaplanetApplicationPage } from "../pages/qaplanet-application.page";
import { testUsers } from "../data/qaplanet-test-data";

test.describe("QAplanet generated regression package", () => {
${cases
  .map(
    (testCase) => `  test("${testCase.testCaseId}: ${escapeForCode(testCase.title ?? testCase.name)}", async ({ page }) => {
    const app = new QaplanetApplicationPage(page);
    await app.goto();
    await app.signIn(testUsers.standard.email, testUsers.standard.password);
    // TODO: Update selectors and setup data for ${testCase.requirementReference}.
    await expect(page.getByRole("heading")).toBeVisible();
  });`
  )
  .join("\n\n")}
});\n`;
}

function buildPageObject(testCases: TestCase[]) {
  const references = Array.from(new Set(testCases.map((testCase) => testCase.requirementReference).filter(Boolean)));
  return `import type { Page } from "@playwright/test";

export class QaplanetApplicationPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(process.env.QAPLANET_BASE_URL ?? "http://localhost:3000");
  }

  async signIn(email = process.env.QAPLANET_TEST_USER ?? "", password = process.env.QAPLANET_TEST_PASSWORD ?? "") {
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/password/i).fill(password);
    await this.page.getByRole("button", { name: /sign in|login/i }).click();
  }

  async openRequirementArea(reference: string) {
    // TODO: Replace with the target application's stable navigation pattern.
    await this.page.getByText(reference, { exact: false }).click();
  }
}

export const coveredRequirementReferences = ${JSON.stringify(references, null, 2)};
`;
}

function buildTestData(testCases: TestCase[]) {
  return `export const testUsers = {
  standard: {
    email: process.env.QAPLANET_TEST_USER ?? "",
    password: process.env.QAPLANET_TEST_PASSWORD ?? ""
  }
};

export const generatedTestCases = ${JSON.stringify(
    testCases.map((testCase) => ({
      id: testCase.testCaseId,
      title: testCase.title ?? testCase.name,
      requirementReference: testCase.requirementReference,
      priority: testCase.priority,
      type: testCase.testType ?? testCase.type
    })),
    null,
    2
  )};
`;
}

function buildEnvHelper() {
  return `export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(\`Missing required environment variable: \${name}\`);
  }
  return value;
}
`;
}

function buildPackageJson() {
  return JSON.stringify(
    {
      name: "qaplanet-playwright-package",
      version: "1.0.0",
      private: true,
      scripts: {
        test: "playwright test",
        "test:headed": "playwright test --headed"
      },
      devDependencies: {
        "@playwright/test": "^1.44.0",
        typescript: "^5.0.0"
      }
    },
    null,
    2
  );
}

function buildPlaywrightConfig() {
  return `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: process.env.QAPLANET_BASE_URL,
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
`;
}

function buildPackageReadme(testCases: TestCase[]) {
  return `# QAplanet Playwright Package

Generated by QAplanet.

## Environment variables

- QAPLANET_BASE_URL
- QAPLANET_TEST_USER
- QAPLANET_TEST_PASSWORD

## Included assets

- tests/qaplanet-generated.spec.ts
- pages/qaplanet-application.page.ts
- data/qaplanet-test-data.ts
- utils/env.ts

Selected test cases: ${testCases.length}
`;
}

function generateGherkinFeatureFromTestCases(testCases: TestCase[]) {
  const cases = testCases.length ? testCases : [];
  const featureTitle = inferFeatureTitle(cases);
  const commonPrecondition = inferCommonPrecondition(cases);

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
    ...cases.flatMap((testCase) => [
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
  const output: string[] = [];
  const precondition = cleanGherkinText(testCase.preconditions || "the required preconditions are met");

  output.push(`    Given ${precondition}`);

  if (!steps.length) {
    output.push(`    When the user completes the ${cleanGherkinText(testCase.title ?? testCase.name)} workflow`);
  } else {
    steps.forEach((step, index) => {
      const keyword = index === 0 ? "When" : "And";
      output.push(`    ${keyword} ${cleanGherkinText(step)}`);
    });
  }

  output.push(`    Then ${cleanGherkinText(testCase.expectedResult || "the expected outcome is displayed")}`);
  return output;
}

function scenarioTags(testCase: TestCase) {
  const tags = new Set<string>(["@regression"]);
  const type = testCase.testType ?? testCase.type;
  const readiness = testCase.automationStatus ?? testCase.readiness;

  if (testCase.priority === "Critical" && !["Negative", "Security", "Performance"].includes(type)) {
    tags.add("@smoke");
  }
  if (type === "Negative") tags.add("@negative");
  if (type === "Security") tags.add("@security");
  if (type === "Accessibility") tags.add("@accessibility");
  if (type === "Performance") tags.add("@performance");
  if (type === "Integration") tags.add("@integration");
  if (readiness === "Manual Only") tags.add("@manual");
  if (readiness === "Automatable") tags.add("@automated");
  if (testCase.requirementReference) {
    tags.add(tagFromText(testCase.requirementReference));
  }

  return [...tags];
}

function inferFeatureTitle(testCases: TestCase[]) {
  const first = testCases[0];
  if (!first) {
    return "QAplanet Generated Behavior";
  }

  const title = first.title ?? first.name;
  const separators = [" - ", ": ", " | "];
  for (const separator of separators) {
    if (title.includes(separator)) {
      const [area] = title.split(separator);
      if (area?.trim()) {
        return businessReadable(area.trim());
      }
    }
  }

  const words = title.split(/\s+/).slice(0, 5).join(" ");
  return businessReadable(words || "QAplanet Generated Behavior");
}

function inferCommonPrecondition(testCases: TestCase[]) {
  const preconditions = testCases.map((testCase) => cleanGherkinText(testCase.preconditions)).filter(Boolean);
  const [first] = preconditions;
  if (first && preconditions.every((item) => item === first)) {
    return first;
  }
  return "the user has access to the application";
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

function mimeTypeForScript(language: AutomationLanguage | undefined) {
  if (language === "python") {
    return "text/x-python";
  }
  if (language === "gherkin") {
    return "text/x-gherkin";
  }
  return "text/typescript";
}

function escapeForCode(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
