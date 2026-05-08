"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Download, FileArchive, FileJson, FileSpreadsheet, FileText, Github, Loader2, Send, Table2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getStoredProjectId } from "@/lib/project-context";
import { sampleTestCases } from "@/lib/sample-data";
import { buildSampleTraceability, sampleAnalysisItems, sampleAutomationAssessments, sampleGeneratedAutomations, sampleRequirementSources } from "@/lib/phase2-sample-data";
import type { AnalysisItem, AutomationAssessment, ExportHistoryItem, GeneratedScript, Project, RequirementSource, TestCase, TraceabilityRow, UsageEvent } from "@/lib/types";
import {
  analysisItemsToCsv,
  azureDevOpsTestCasesToCsv,
  downloadTextFile,
  downloadWorkbook,
  itemsToMarkdown,
  jiraTestCasesToCsv,
  markdownTestPlan,
  readinessToCsv,
  testCasesToCsv,
  testCasesToMarkdown,
  traceabilityToCsv,
  xrayTestCasesToJson
} from "@/lib/exports";

type ExportScope = "Test cases" | "Analysis items" | "Automation readiness" | "Traceability matrix";
type ExportFormat = "CSV" | "Markdown" | "JSON" | "Excel";
type PackageData = {
  project: Project;
  sources: RequirementSource[];
  testCases: TestCase[];
  analysisItems: AnalysisItem[];
  readiness: AutomationAssessment[];
  traceability: TraceabilityRow[];
  scripts: GeneratedScript[];
};

export default function ExportsPage() {
  const [project, setProject] = useState<Project>({ name: "Customer portal QA initiative", description: "Sample project for requirements analysis and automation generation." });
  const [sources, setSources] = useState<RequirementSource[]>(sampleRequirementSources);
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>(sampleAnalysisItems);
  const [readiness, setReadiness] = useState<AutomationAssessment[]>(sampleAutomationAssessments);
  const [traceability, setTraceability] = useState<TraceabilityRow[]>(buildSampleTraceability());
  const [scripts, setScripts] = useState<GeneratedScript[]>(sampleGeneratedAutomations);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [packageLoading, setPackageLoading] = useState(false);
  const [integrationLoading, setIntegrationLoading] = useState("");
  const [githubPackageLoading, setGithubPackageLoading] = useState(false);
  const [managementOptions, setManagementOptions] = useState({
    areaPath: "",
    iterationPath: "",
    tags: "qaplanet",
    assignedTo: ""
  });
  const [githubPackageType, setGithubPackageType] = useState<"typescript" | "python">("typescript");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProject(readJson(appStorageKeys.project, { name: "Customer portal QA initiative", description: "Sample project for requirements analysis and automation generation." }));
    setSources(readJson(appStorageKeys.requirementSources, sampleRequirementSources));
    setTestCases(readJson(appStorageKeys.testCases, sampleTestCases));
    setAnalysisItems(readJson(appStorageKeys.analysisItems, sampleAnalysisItems));
    setReadiness(readJson(appStorageKeys.automationAssessments, sampleAutomationAssessments));
    setTraceability(readJson(appStorageKeys.traceabilityRows, buildSampleTraceability()));
    setScripts(readJson(appStorageKeys.generatedAutomations, sampleGeneratedAutomations));
    setExportHistory(readJson(appStorageKeys.exportHistory, []));
  }, []);

  const counts = useMemo(
    () => ({
      "Test cases": testCases.length,
      "Analysis items": analysisItems.length,
      "Automation readiness": readiness.length,
      "Traceability matrix": traceability.length
    }),
    [analysisItems.length, readiness.length, testCases.length, traceability.length]
  );
  const automatableCount = testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Automatable").length;

  async function downloadProjectPackage() {
    setPackageLoading(true);
    setMessage("");

    try {
      const data = await loadPackageData({
        project,
        sources,
        testCases,
        analysisItems,
        readiness,
        traceability,
        scripts
      });
      const today = new Date().toISOString().slice(0, 10);
      const safeProjectName = safeFileName(data.project.name || "QAplanet_Project");
      const rootName = `QAplanet_${safeProjectName}_${today}`;
      const zip = new JSZip();
      const root = zip.folder(rootName);

      if (!root) {
        throw new Error("Could not create export package.");
      }

      root.file("01_Project_Summary.md", buildProjectSummary(data));
      root.file("02_Test_Cases.csv", data.testCases.length ? testCasesToCsv(data.testCases) : placeholderCsv("No test cases were available at the time of export."));
      root.file("03_Test_Cases.json", data.testCases.length ? JSON.stringify(data.testCases, null, 2) : placeholderJson("No test cases were available at the time of export."));
      root.file("04_Analysis_Items.md", data.analysisItems.length ? itemsToMarkdown("Analysis Items", rowsForScope("Analysis items", data)) : placeholderMarkdown("Analysis Items", "No analysis items were available at the time of export."));
      root.file("05_Analysis_Items.json", data.analysisItems.length ? JSON.stringify(data.analysisItems, null, 2) : placeholderJson("No analysis items were available at the time of export."));
      root.file("06_Automation_Readiness.csv", data.readiness.length ? readinessToCsv(data.readiness) : placeholderCsv("No automation readiness records were available at the time of export."));
      root.file("07_Automation_Readiness.json", data.readiness.length ? JSON.stringify(data.readiness, null, 2) : placeholderJson("No automation readiness records were available at the time of export."));
      root.file("08_Traceability_Matrix.csv", data.traceability.length ? traceabilityToCsv(data.traceability) : placeholderCsv("No traceability rows were available at the time of export."));
      root.file("09_Traceability_Matrix.json", data.traceability.length ? JSON.stringify(data.traceability, null, 2) : placeholderJson("No traceability rows were available at the time of export."));

      const automationFolder = root.folder("generated-automation");
      if (!automationFolder) {
        throw new Error("Could not create generated automation folder.");
      }
      addGeneratedAutomationFiles(automationFolder, data.scripts, data.testCases);

      const blob = await zip.generateAsync({ type: "blob" });
      const zipFileName = `${rootName}.zip`;
      saveAs(blob, zipFileName);
      recordExport({ fileName: zipFileName, exportType: "Complete Project Package", rowCount: data.testCases.length + data.analysisItems.length + data.traceability.length });
      setMessage(`Complete project package downloaded: ${zipFileName}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project package export failed.");
    } finally {
      setPackageLoading(false);
    }
  }

  async function exportData(scope: ExportScope, format: ExportFormat) {
    const fileBase = `qaplanet-${scope.toLowerCase().replaceAll(" ", "-")}`;
    const rows = rowsForScope(scope, { testCases, analysisItems, readiness, traceability });

    if (format === "CSV") {
      const content =
        scope === "Test cases"
          ? testCasesToCsv(testCases)
          : scope === "Analysis items"
            ? analysisItemsToCsv(analysisItems)
            : scope === "Automation readiness"
              ? readinessToCsv(readiness)
              : traceabilityToCsv(traceability);
      downloadTextFile(`${fileBase}.csv`, content, "text/csv");
    }

    if (format === "Markdown") {
      const content = scope === "Test cases" ? testCasesToMarkdown(testCases) : itemsToMarkdown(scope, rows);
      downloadTextFile(`${fileBase}.md`, content, "text/markdown");
    }

    if (format === "JSON") {
      downloadTextFile(`${fileBase}.json`, JSON.stringify(rows, null, 2), "application/json");
    }

    if (format === "Excel") {
      await downloadWorkbook({ [scope]: rows }, `${fileBase}.xlsx`);
    }

    await saveExportMetadata(scope, format, `${fileBase}.${extensionForFormat(format)}`, rows.length);
    recordExport({ fileName: `${fileBase}.${extensionForFormat(format)}`, exportType: `${scope} ${format}`, rowCount: rows.length });
    setMessage(`${scope} exported as ${format}.`);
  }

  async function exportIntegration(type: "azure" | "jira" | "xray" | "markdown") {
    setIntegrationLoading(type);
    setMessage("");
    try {
      const date = new Date().toISOString().slice(0, 10);
      const options = managementOptions;

      if (type === "azure") {
        const fileName = `qaplanet-azure-devops-test-cases-${date}.csv`;
        downloadTextFile(fileName, azureDevOpsTestCasesToCsv(testCases, options), "text/csv");
        await saveExportMetadata("Test cases", "CSV", fileName, testCases.length);
        recordExport({ fileName, exportType: "Azure DevOps Test Cases CSV", rowCount: testCases.length });
        setMessage("Azure DevOps CSV exported.");
      }

      if (type === "jira") {
        const fileName = `qaplanet-jira-test-cases-${date}.csv`;
        downloadTextFile(fileName, jiraTestCasesToCsv(testCases, options), "text/csv");
        await saveExportMetadata("Test cases", "CSV", fileName, testCases.length);
        recordExport({ fileName, exportType: "Jira CSV", rowCount: testCases.length });
        setMessage("Jira CSV exported.");
      }

      if (type === "xray") {
        const fileName = `qaplanet-xray-tests-${date}.json`;
        downloadTextFile(fileName, xrayTestCasesToJson(testCases, options), "application/json");
        await saveExportMetadata("Test cases", "JSON", fileName, testCases.length);
        recordExport({ fileName, exportType: "Xray JSON", rowCount: testCases.length });
        setMessage("Xray JSON exported.");
      }

      if (type === "markdown") {
        const fileName = `qaplanet-markdown-test-plan-${date}.md`;
        downloadTextFile(fileName, markdownTestPlan(testCases, `${project.name || "QAplanet"} Test Plan`), "text/markdown");
        await saveExportMetadata("Test cases", "Markdown", fileName, testCases.length);
        recordExport({ fileName, exportType: "Markdown Test Plan", rowCount: testCases.length });
        setMessage("Markdown test plan exported.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Integration export failed.");
    } finally {
      setIntegrationLoading("");
    }
  }

  async function downloadGithubReadyPackage() {
    setGithubPackageLoading(true);
    setMessage("");
    try {
      const zip = new JSZip();
      const root = zip.folder("qaplanet-github-automation-package");
      if (!root) {
        throw new Error("Could not create GitHub automation package.");
      }

      const matchingFeature = scripts.find((script) => script.language === "gherkin");
      const matchingPython = scripts.find((script) => script.language === "python");
      const matchingTypescript = scripts.find((script) => script.language === "typescript");

      root.file(".env.example", ["QAPLANET_BASE_URL=", "QAPLANET_TEST_USER=", "QAPLANET_TEST_PASSWORD="].join("\n"));
      root.file(".gitignore", ["node_modules/", ".env", "reports/", "test-results/", "__pycache__/", ".pytest_cache/"].join("\n"));
      root.file("README.md", buildGithubPackageReadme(githubPackageType, testCases.length));
      root.file("features/qaplanet-generated.feature", matchingFeature?.code || placeholderFeature(project.name));
      root.file("data/qaplanet-test-data.json", JSON.stringify(rowsForScope("Test cases", { testCases, analysisItems, readiness, traceability }), null, 2));
      root.file("utils/README.md", "Add shared configuration, logging, fixture, and test data helpers here.\n");
      root.file("pages/README.md", "Add page objects and reusable screen interactions here.\n");

      if (githubPackageType === "python") {
        root.file("steps/qaplanet_steps.py", matchingPython?.code || "# Generate Python pytest-bdd step definitions in QAplanet before replacing this placeholder.\n");
        root.file("tests/README.md", "Pytest-bdd scenarios are discovered from feature files and step definitions. Add non-BDD pytest tests here if needed.\n");
        root.file("pytest.ini", "[pytest]\nmarkers =\n    smoke: smoke tests\n    regression: regression tests\n    ui: UI tests\n");
        root.file("requirements.txt", ["pytest", "pytest-bdd", "playwright", "allure-pytest", "python-dotenv"].join("\n"));
      } else {
        root.file("steps/README.md", "Step definition files are used by BDD packages. TypeScript Playwright specs live under tests/.\n");
        root.file("tests/qaplanet-generated.spec.ts", matchingTypescript?.code || "// Generate Playwright TypeScript automation in QAplanet before replacing this placeholder.\n");
        root.file("playwright.config.ts", buildGithubPlaywrightConfig());
        root.file("package.json", buildGithubPackageJson());
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const fileName = `qaplanet-github-${githubPackageType}-automation-package.zip`;
      saveAs(blob, fileName);
      recordExport({ fileName, exportType: "GitHub-ready Automation Package", rowCount: testCases.length });
      setMessage("GitHub-ready automation package downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GitHub automation package generation failed.");
    } finally {
      setGithubPackageLoading(false);
    }
  }

  function recordExport(item: { fileName: string; exportType: string; rowCount?: number }) {
    const nextHistory: ExportHistoryItem[] = [
      {
        id: crypto.randomUUID(),
        fileName: item.fileName,
        exportType: item.exportType,
        rowCount: item.rowCount,
        createdAt: new Date().toISOString()
      },
      ...exportHistory
    ].slice(0, 20);
    setExportHistory(nextHistory);
    writeJson(appStorageKeys.exportHistory, nextHistory);
    recordUsageEvent(item.exportType.includes("Package") ? "package_generated" : "export_created");
  }

  return (
    <AppShell>
      <PageHeader
        title="Export Center"
        description="Export QA deliverables for review, audit, test management import, automation handoff, and traceability reporting."
      />

      <section className="mb-5">
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-950">Export Packages</h2>
          <p className="mt-1 text-sm text-slate-600">Bundle project deliverables into a stakeholder-ready ZIP package.</p>
        </div>
        <article className="card p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-brand-blue">
                <FileArchive className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-950">Complete Project Package</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Download all QAplanet deliverables for this project, including test cases, analysis items, readiness scoring, traceability matrix, and generated automation scripts.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="blue">{project.name}</Badge>
                  <Badge>{testCases.length} test cases</Badge>
                  <Badge>{analysisItems.length} analysis items</Badge>
                  <Badge>{scripts.length} scripts</Badge>
                  <Badge>{traceability.length} traceability rows</Badge>
                  <Badge tone="teal">{automatableCount} automatable</Badge>
                </div>
              </div>
            </div>
            <Button
              onClick={downloadProjectPackage}
              disabled={packageLoading}
              icon={packageLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            >
              {packageLoading ? "Preparing ZIP" : "Download ZIP"}
            </Button>
          </div>
        </article>
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Send className="size-5 text-brand-blue" aria-hidden />
                <h2 className="text-lg font-bold text-slate-950">Test Management Exports</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Generate import-ready artifacts for Azure DevOps, Jira, Xray, and stakeholder test planning without pushing to live APIs.
              </p>
            </div>
            <Badge tone="teal">{testCases.length} test cases</Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <FieldText label="Area Path" value={managementOptions.areaPath} onChange={(value) => setManagementOptions((current) => ({ ...current, areaPath: value }))} placeholder="QAplanet\\Portal" />
            <FieldText label="Iteration Path" value={managementOptions.iterationPath} onChange={(value) => setManagementOptions((current) => ({ ...current, iterationPath: value }))} placeholder="QAplanet\\Release 1" />
            <FieldText label="Tags" value={managementOptions.tags} onChange={(value) => setManagementOptions((current) => ({ ...current, tags: value }))} placeholder="qaplanet;regression" />
            <FieldText label="Assigned To" value={managementOptions.assignedTo} onChange={(value) => setManagementOptions((current) => ({ ...current, assignedTo: value }))} placeholder="qa.lead@example.com" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={integrationLoading === "azure"} onClick={() => exportIntegration("azure")} icon={integrationLoading === "azure" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}>
              Export Azure DevOps CSV
            </Button>
            <Button variant="secondary" disabled={integrationLoading === "jira"} onClick={() => exportIntegration("jira")} icon={integrationLoading === "jira" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}>
              Export Jira CSV
            </Button>
            <Button variant="secondary" disabled={integrationLoading === "xray"} onClick={() => exportIntegration("xray")} icon={integrationLoading === "xray" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}>
              Export Xray JSON
            </Button>
            <Button variant="secondary" disabled={integrationLoading === "markdown"} onClick={() => exportIntegration("markdown")} icon={integrationLoading === "markdown" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}>
              Export Markdown Test Plan
            </Button>
          </div>
        </article>

        <article className="card p-5">
          <div className="flex items-center gap-2">
            <Github className="size-5 text-slate-950" aria-hidden />
            <h2 className="text-lg font-bold text-slate-950">GitHub Automation Package</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Prepare a repository-ready ZIP with automation assets, environment placeholders, README, and ignore rules.
          </p>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Package type</span>
            <select
              className="focus-ring min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              value={githubPackageType}
              onChange={(event) => setGithubPackageType(event.target.value as "typescript" | "python")}
            >
              <option value="typescript">Playwright TypeScript Package</option>
              <option value="python">Playwright Python pytest-bdd Package</option>
            </select>
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={downloadGithubReadyPackage} disabled={githubPackageLoading} icon={githubPackageLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileArchive className="size-4" aria-hidden />}>
              Generate GitHub-ready ZIP
            </Button>
          </div>
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">GitHub push coming soon</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Connect GitHub -> Select repository -> Create branch -> Commit automation package -> Open pull request.
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {(["Test cases", "Analysis items", "Automation readiness", "Traceability matrix"] as ExportScope[]).map((scope) => (
          <article key={scope} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {iconForScope(scope)}
                  <h2 className="text-lg font-semibold text-slate-950">{scope}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{descriptionForScope(scope)}</p>
              </div>
              <Badge tone="teal">{counts[scope]} rows</Badge>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(["CSV", "Markdown", "JSON", "Excel"] as ExportFormat[]).map((format) => (
                <Button key={format} variant="secondary" onClick={() => exportData(scope, format)} icon={<Download className="size-4" aria-hidden />}>
                  {format}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-700">Export History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">File name</th>
                <th className="px-4 py-3">Export type</th>
                <th className="px-4 py-3">Created date</th>
                <th className="px-4 py-3">Download action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exportHistory.length ? (
                exportHistory.map((item) => (
                  <tr key={item.id} className="table-row">
                    <td className="px-4 py-3 font-semibold text-slate-800">{item.fileName}</td>
                    <td className="px-4 py-3">{item.exportType}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500">Regenerate from export cards</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>No exports have been generated in this browser session yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
    </AppShell>
  );
}

async function saveExportMetadata(scope: ExportScope, format: ExportFormat, fileName: string, rowCount: number) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    return;
  }

  const ownerId = user.data.user.id;
  const projectId = getStoredProjectId();
  await supabase.from("exports").insert({
    ...(projectId ? { project_id: projectId } : {}),
    owner_id: ownerId,
    export_type: format.toLowerCase(),
    export_scope: scope,
    export_format: format,
    row_count: rowCount,
    file_name: fileName
  });
}

async function loadPackageData(fallback: PackageData): Promise<PackageData> {
  const supabase = createSupabaseBrowserClient();
  const projectId = getStoredProjectId();
  if (!supabase || !projectId) {
    return fallback;
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    return fallback;
  }

  const [projectResult, sourcesResult, analysisResult, testCasesResult, readinessResult, scriptsResult] = await Promise.all([
    supabase.from("projects").select("id, name, description, created_at").eq("id", projectId).maybeSingle(),
    supabase.from("requirement_sources").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("analysis_items").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("test_cases").select("*").eq("project_id", projectId).order("test_case_id", { ascending: true }),
    supabase.from("automation_assessments").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("generated_automation").select("*").eq("project_id", projectId).order("created_at", { ascending: true })
  ]);

  const error =
    projectResult.error ||
    sourcesResult.error ||
    analysisResult.error ||
    testCasesResult.error ||
    readinessResult.error ||
    scriptsResult.error;

  if (error) {
    throw new Error(`Failed to load project package data: ${error.message}`);
  }

  const sources = Array.isArray(sourcesResult.data) ? sourcesResult.data.map(rowToRequirementSource) : [];
  const analysisItems = Array.isArray(analysisResult.data) ? analysisResult.data.map(rowToAnalysisItem) : [];
  const testCases = Array.isArray(testCasesResult.data) ? testCasesResult.data.map(rowToTestCase) : [];
  const scripts = Array.isArray(scriptsResult.data) ? scriptsResult.data.map(rowToGeneratedScript) : [];
  const readiness = Array.isArray(readinessResult.data) ? readinessResult.data.map((row) => rowToAutomationAssessment(row as Record<string, unknown>, testCases)) : [];

  return {
    project: projectResult.data
      ? {
          id: String(projectResult.data.id ?? projectId),
          name: String(projectResult.data.name ?? fallback.project.name),
          description: String(projectResult.data.description ?? fallback.project.description ?? ""),
          created_at: String(projectResult.data.created_at ?? "")
        }
      : fallback.project,
    sources,
    analysisItems,
    testCases,
    readiness,
    scripts,
    traceability: buildTraceabilityRows(sources, analysisItems, testCases, scripts)
  };
}

function buildProjectSummary(data: PackageData) {
  const exportDate = new Date();
  const automatable = data.testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Automatable").length;
  const needsData = data.testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Needs API/Data").length;
  const manualOnly = data.testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Manual Only").length;

  return [
    `# ${data.project.name || "QAplanet Project"} Summary`,
    "",
    `**Project name:** ${data.project.name || "Untitled project"}`,
    `**Project description:** ${data.project.description || "No description provided."}`,
    `**Export date/time:** ${exportDate.toLocaleString()}`,
    "",
    "## Totals",
    "",
    `- Total requirement sources: ${data.sources.length}`,
    `- Total analysis items: ${data.analysisItems.length}`,
    `- Total test cases: ${data.testCases.length}`,
    `- Total automatable test cases: ${automatable}`,
    `- Total Needs API/Data test cases: ${needsData}`,
    `- Total Manual Only test cases: ${manualOnly}`,
    `- Total generated scripts: ${data.scripts.length}`,
    "",
    "Generated by QAplanet, a PlanetKosa product."
  ].join("\n");
}

function addGeneratedAutomationFiles(folder: JSZip, scripts: GeneratedScript[], testCases: TestCase[]) {
  if (!scripts.length) {
    folder.file("README.md", "No generated automation scripts were available at the time of export.\n");
    return;
  }

  folder.file(
    "README.md",
    [
      "# Generated Automation",
      "",
      "This folder contains generated automation scripts exported from QAplanet.",
      "",
      `Total scripts: ${scripts.length}`
    ].join("\n")
  );

  scripts.forEach((script, index) => {
    const linkedTestCase = testCases.find((testCase) => script.testCaseIds.includes(testCase.id) || script.testCaseIds.includes(testCase.testCaseId));
    const testCaseId = linkedTestCase?.testCaseId ?? `script-${index + 1}`;
    const extension = script.language === "python" ? "py" : script.language === "gherkin" ? "feature" : "ts";
    const baseName = safeFileName(script.name || `${testCaseId}-playwright.${extension}`);
    const fileName = baseName.toLowerCase().endsWith(`.${extension}`)
      ? `${safeFileName(testCaseId)}_${baseName}`
      : `${safeFileName(testCaseId)}_${baseName}.${extension}`;
    folder.file(fileName, script.code || `// No generated code was available for ${script.name || testCaseId}.\n`);
  });
}

function buildTraceabilityRows(
  sources: RequirementSource[],
  analysisItems: AnalysisItem[],
  testCases: TestCase[],
  scripts: GeneratedScript[]
): TraceabilityRow[] {
  return testCases.map((testCase, index) => {
    const analysisItem =
      analysisItems.find((item) => testCase.analysisItemIds?.includes(item.id)) ??
      analysisItems[index % Math.max(analysisItems.length, 1)];
    const source =
      sources.find((item) => testCase.requirementSourceIds?.includes(item.id)) ??
      sources.find((item) => item.id === analysisItem?.requirementSourceId) ??
      sources[0];
    const script = scripts.find((item) => item.testCaseIds.includes(testCase.id) || item.testCaseIds.includes(testCase.testCaseId));

    return {
      requirementReference: testCase.requirementReference,
      sourceDocument: source?.fileName ?? "Unknown source",
      analysisItem: analysisItem?.referenceCode ?? testCase.requirementReference,
      testCaseId: testCase.testCaseId,
      testCaseTitle: testCase.title ?? testCase.name,
      automationStatus: testCase.automationStatus ?? testCase.readiness,
      generatedScript: script?.name ?? "Not generated",
      approvalStatus: testCase.approvalStatus ?? testCase.status
    };
  });
}

function rowToRequirementSource(row: Record<string, unknown>): RequirementSource {
  return {
    id: stringValue(row.id) || crypto.randomUUID(),
    projectId: stringValue(row.project_id),
    fileName: stringValue(row.file_name) || "Requirement source",
    sourceType: row.source_type === "Manual Paste" ? "Manual Paste" : "Upload",
    fileType: stringValue(row.file_type) || "text/plain",
    fileSize: numberValue(row.file_size),
    storagePath: stringValue(row.storage_path),
    extractedText: stringValue(row.extracted_text),
    processingStatus: row.processing_status === "Failed" ? "Failed" : row.processing_status === "Extracted" ? "Extracted" : row.processing_status === "Uploaded" ? "Uploaded" : "Analysis Ready",
    createdAt: stringValue(row.created_at) || new Date().toISOString()
  };
}

function rowToAnalysisItem(row: Record<string, unknown>): AnalysisItem {
  return {
    id: stringValue(row.id) || crypto.randomUUID(),
    requirementSourceId: stringValue(row.requirement_source_id),
    itemType: String(row.item_type ?? "Business Rule") as AnalysisItem["itemType"],
    title: stringValue(row.title) || "Analysis item",
    description: stringValue(row.description),
    referenceCode: stringValue(row.reference_code) || "ANL-001",
    confidenceScore: numberValue(row.confidence_score, 0.75)
  };
}

function rowToTestCase(row: Record<string, unknown>): TestCase {
  const type = String(row.test_type ?? row.type ?? "Functional") as TestCase["type"];
  const readiness = String(row.automation_status ?? row.readiness ?? "Manual Only") as TestCase["readiness"];
  const status = String(row.approval_status ?? row.status ?? "Draft") as TestCase["status"];

  return {
    id: stringValue(row.id) || crypto.randomUUID(),
    testCaseId: stringValue(row.test_case_id) || "QA-TC-001",
    name: stringValue(row.name) || stringValue(row.title) || "Generated test case",
    title: stringValue(row.title) || stringValue(row.name) || "Generated test case",
    description: stringValue(row.description),
    preconditions: stringValue(row.preconditions),
    steps: Array.isArray(row.steps) ? row.steps.map(String) : [],
    expectedResult: stringValue(row.expected_result),
    priority: String(row.priority ?? "Medium") as TestCase["priority"],
    type,
    testType: type,
    requirementReference: stringValue(row.requirement_reference) || "UNMAPPED",
    automationCandidate: Boolean(row.automation_candidate),
    automationNotes: stringValue(row.automation_notes),
    readiness,
    automationStatus: readiness,
    readinessConfidence: numberValue(row.readiness_confidence, undefined),
    readinessReason: stringValue(row.readiness_reason),
    recommendedFramework: stringValue(row.recommended_framework) as TestCase["recommendedFramework"],
    status,
    approvalStatus: status,
    analysisItemIds: Array.isArray(row.analysis_item_ids) ? row.analysis_item_ids.map(String) : [],
    requirementSourceIds: Array.isArray(row.requirement_source_ids) ? row.requirement_source_ids.map(String) : []
  };
}

function rowToAutomationAssessment(row: Record<string, unknown>, testCases: TestCase[]): AutomationAssessment {
  const testCaseRef = stringValue(row.test_case_ref) || stringValue(row.test_case_id);
  const linkedTestCase = testCases.find((testCase) => testCase.id === testCaseRef || testCase.testCaseId === testCaseRef);
  const readiness = String(row.readiness ?? linkedTestCase?.readiness ?? "Manual Only") as AutomationAssessment["readiness"];

  return {
    id: stringValue(row.id) || crypto.randomUUID(),
    testCaseId: linkedTestCase?.id ?? testCaseRef,
    readiness,
    confidenceScore: numberValue(row.confidence_score, 0.75),
    reason: stringValue(row.reason) || stringValue(row.notes) || "No readiness reason was available.",
    recommendedFramework: (stringValue(row.recommended_framework) || (readiness === "Manual Only" ? "Manual" : "Playwright")) as AutomationAssessment["recommendedFramework"]
  };
}

function rowToGeneratedScript(row: Record<string, unknown>): GeneratedScript {
  const language = row.language === "python" ? "python" : row.language === "gherkin" ? "gherkin" : "typescript";

  return {
    id: stringValue(row.id) || crypto.randomUUID(),
    testCaseIds: Array.isArray(row.test_case_ids) ? row.test_case_ids.map(String) : [],
    name: stringValue(row.name) || (language === "python" ? "generated.spec.py" : language === "gherkin" ? "generated_feature.feature" : "generated.spec.ts"),
    code: stringValue(row.code),
    createdAt: stringValue(row.created_at) || new Date().toISOString(),
    language,
    framework: language === "gherkin" ? "Gherkin Feature" : language === "python" ? "Playwright Python" : "Playwright",
    generationType: stringValue(row.generation_type).includes("Python BDD") ? "pythonBdd" : language === "gherkin" ? "feature" : "script",
    linkedFeatureFileName: stringValue(row.linked_feature_file_name) || undefined
  };
}

function placeholderCsv(message: string) {
  return `"Message"\n"${message.replace(/"/g, '""')}"`;
}

function placeholderJson(message: string) {
  return JSON.stringify({ message, items: [] }, null, 2);
}

function placeholderMarkdown(title: string, message: string) {
  return [`# ${title}`, "", message].join("\n");
}

function placeholderFeature(projectName: string) {
  return [
    "# Purpose: Placeholder feature file generated for a GitHub-ready QAplanet package.",
    "",
    "@qaplanet",
    `Feature: ${projectName || "QAplanet"} generated automation`,
    "",
    "  Scenario: Replace this placeholder with generated Gherkin",
    "    Given generated QAplanet test cases are available",
    "    When the team generates a feature file",
    "    Then this placeholder is replaced with business-readable scenarios"
  ].join("\n");
}

function buildGithubPackageReadme(packageType: "typescript" | "python", testCaseCount: number) {
  const setup =
    packageType === "python"
      ? ["1. Create a virtual environment.", "2. Run `pip install -r requirements.txt`.", "3. Run `playwright install`.", "4. Set `QAPLANET_BASE_URL` and test user environment variables.", "5. Run `pytest`."]
      : ["1. Run `npm install`.", "2. Run `npx playwright install`.", "3. Set `QAPLANET_BASE_URL` and test user environment variables.", "4. Run `npm test`."];

  return [
    "# QAplanet GitHub Automation Package",
    "",
    `Package type: ${packageType === "python" ? "Playwright Python pytest-bdd" : "Playwright TypeScript"}`,
    `Selected test cases: ${testCaseCount}`,
    "",
    "## Setup",
    "",
    ...setup,
    "",
    "## Security",
    "",
    "No credentials are included. Use `.env.example` as a template and store real secrets in your CI/CD secret manager."
  ].join("\n");
}

function buildGithubPlaywrightConfig() {
  return `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: process.env.QAPLANET_BASE_URL,
    trace: "on-first-retry"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
`;
}

function buildGithubPackageJson() {
  return JSON.stringify(
    {
      name: "qaplanet-automation-package",
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

function recordUsageEvent(eventType: UsageEvent["eventType"]) {
  const events = readJson<UsageEvent[]>(appStorageKeys.usageEvents, []);
  const nextEvents: UsageEvent[] = [
    {
      id: crypto.randomUUID(),
      projectId: getStoredProjectId(),
      eventType,
      quantity: 1,
      createdAt: new Date().toISOString()
    },
    ...events
  ].slice(0, 100);
  writeJson(appStorageKeys.usageEvents, nextEvents);
}

function safeFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "QAplanet_Project";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function extensionForFormat(format: ExportFormat) {
  if (format === "Markdown") return "md";
  if (format === "Excel") return "xlsx";
  return format.toLowerCase();
}

function rowsForScope(
  scope: ExportScope,
  data: {
    testCases: TestCase[];
    analysisItems: AnalysisItem[];
    readiness: AutomationAssessment[];
    traceability: TraceabilityRow[];
  }
): Record<string, string | number | boolean>[] {
  if (scope === "Test cases") {
    return data.testCases.map((testCase) => ({
      test_case_id: testCase.testCaseId,
      title: testCase.title ?? testCase.name,
      requirement_reference: testCase.requirementReference,
      priority: testCase.priority,
      type: testCase.testType ?? testCase.type,
      automation_status: testCase.automationStatus ?? testCase.readiness,
      approval_status: testCase.approvalStatus ?? testCase.status
    }));
  }
  if (scope === "Analysis items") {
    return data.analysisItems.map((item) => ({
      reference_code: item.referenceCode,
      item_type: item.itemType,
      title: item.title,
      description: item.description,
      confidence_score: item.confidenceScore
    }));
  }
  if (scope === "Automation readiness") {
    return data.readiness.map((item) => ({
      test_case_id: item.testCaseId,
      readiness: item.readiness,
      confidence_score: item.confidenceScore,
      reason: item.reason,
      recommended_framework: item.recommendedFramework
    }));
  }
  return data.traceability.map((row) => ({
    requirement_reference: row.requirementReference,
    source_document: row.sourceDocument,
    analysis_item: row.analysisItem,
    test_case_id: row.testCaseId,
    test_case_title: row.testCaseTitle,
    automation_status: row.automationStatus,
    generated_script: row.generatedScript,
    approval_status: row.approvalStatus
  }));
}

function iconForScope(scope: ExportScope): ReactNode {
  if (scope === "Test cases") return <FileText className="size-5 text-brand-blue" aria-hidden />;
  if (scope === "Analysis items") return <FileJson className="size-5 text-brand-blue" aria-hidden />;
  if (scope === "Automation readiness") return <FileSpreadsheet className="size-5 text-brand-blue" aria-hidden />;
  return <Table2 className="size-5 text-brand-blue" aria-hidden />;
}

function descriptionForScope(scope: ExportScope) {
  if (scope === "Test cases") return "Structured test cases for QA execution, approval, and test management import.";
  if (scope === "Analysis items") return "Business rules, stories, criteria, risks, assumptions, actors, integrations, and data needs.";
  if (scope === "Automation readiness") return "Readiness classifications, confidence scores, reasons, and recommended framework.";
  return "Requirement source to analysis item to test case to generated automation mapping.";
}

function FieldText({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        className="focus-ring min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
