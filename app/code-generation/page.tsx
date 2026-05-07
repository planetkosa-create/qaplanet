"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clipboard, Download, Loader2, Play, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { sampleScript, sampleTestCases } from "@/lib/sample-data";
import { sampleGeneratedAutomations, samplePythonScript } from "@/lib/phase2-sample-data";
import type { AutomationLanguage, GeneratedScript, TestCase } from "@/lib/types";
import { downloadTextFile } from "@/lib/exports";

export default function CodeGenerationPage() {
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [language, setLanguage] = useState<AutomationLanguage>("typescript");
  const [scripts, setScripts] = useState<GeneratedScript[]>(sampleGeneratedAutomations);
  const [activeScript, setActiveScript] = useState<GeneratedScript>({ ...sampleScript, language: "typescript", framework: "Playwright" });
  const [loading, setLoading] = useState(false);
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

    await supabase.from("generated_automation").insert({
      id: activeScript.id,
      owner_id: ownerId,
      name: activeScript.name,
      language: activeScript.language ?? language,
      framework: activeScript.framework ?? "Playwright",
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
              Generate Code
            </Button>
            <Button variant="secondary" onClick={copyCode} icon={<Clipboard className="size-4" aria-hidden />}>Copy</Button>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Selected Automatable Cases</h2>
              <Badge tone="blue">{selectedTestCases.length} ready</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {selectedTestCases.length ? (
                selectedTestCases.map((testCase) => (
                  <div key={testCase.id} className="rounded-md border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-950">{testCase.testCaseId}: {testCase.title ?? testCase.name}</p>
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
              <p className="text-sm text-slate-500">Playwright {activeScript.language === "python" ? "Python" : "TypeScript"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={saveScript} icon={<Save className="size-4" aria-hidden />}>Save Script</Button>
              <Button
                variant="secondary"
                onClick={() => downloadTextFile(fileName, activeScript.code, activeScript.language === "python" ? "text/x-python" : "text/typescript")}
                icon={<Download className="size-4" aria-hidden />}
              >
                Download
              </Button>
            </div>
          </div>
          <pre className="max-h-[700px] overflow-auto bg-slate-950 p-5 text-xs leading-6 text-slate-100">
            <code>{activeScript.language === "python" && !activeScript.code ? samplePythonScript.code : activeScript.code}</code>
          </pre>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
    </AppShell>
  );
}
