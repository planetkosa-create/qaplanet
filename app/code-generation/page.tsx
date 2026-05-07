"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clipboard, Download, Loader2, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { sampleScript, sampleTestCases } from "@/lib/sample-data";
import type { GeneratedScript, TestCase } from "@/lib/types";
import { downloadTextFile } from "@/lib/exports";

export default function CodeGenerationPage() {
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [script, setScript] = useState<GeneratedScript>(sampleScript);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const cases = readJson(appStorageKeys.testCases, sampleTestCases);
    setTestCases(cases);
    setSelectedIds(readJson(appStorageKeys.selectedTestCases, cases.filter((testCase) => testCase.readiness === "Automatable").map((testCase) => testCase.id)));
    setScript(readJson(appStorageKeys.generatedScript, sampleScript));
  }, []);

  const selectedTestCases = useMemo(() => testCases.filter((testCase) => selectedIds.includes(testCase.id)), [testCases, selectedIds]);

  async function generateScript() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/ai/generate-scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testCases: selectedTestCases })
    });
    const data = (await response.json()) as { script?: GeneratedScript; error?: string };
    setLoading(false);

    if (!response.ok || !data.script) {
      setMessage(data.error ?? "Script generation failed. Check your OpenAI API key.");
      return;
    }

    setScript(data.script);
    writeJson(appStorageKeys.generatedScript, data.script);
    setMessage("Playwright TypeScript script generated.");
  }

  async function copyCode() {
    await navigator.clipboard.writeText(script.code);
    setMessage("Code copied to clipboard.");
  }

  return (
    <AppShell>
      <PageHeader
        title="Code Generation"
        description="Generate maintainable Playwright TypeScript scripts for selected automation candidates using accessible locators and environment placeholders."
        actions={
          <>
            <Button onClick={generateScript} disabled={loading || selectedTestCases.length === 0} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}>
              Generate Playwright Code
            </Button>
            <Button variant="secondary" onClick={copyCode} icon={<Clipboard className="size-4" aria-hidden />}>Copy Code</Button>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Selected Test Cases</h2>
            <Badge tone="blue">{selectedTestCases.length} selected</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {selectedTestCases.length ? (
              selectedTestCases.map((testCase) => (
                <div key={testCase.id} className="rounded-md border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-950">{testCase.testCaseId}: {testCase.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{testCase.automationNotes}</p>
                </div>
              ))
            ) : (
              <EmptyState
                title="No selected cases"
                description="Select automatable test cases before generating Playwright code."
                action={<Link href="/automation-readiness"><Button variant="secondary">Select Cases</Button></Link>}
              />
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{script.name}</h2>
              <p className="text-sm text-slate-500">Generated Playwright TypeScript</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => downloadTextFile(script.name, script.code, "text/typescript")}
              icon={<Download className="size-4" aria-hidden />}
            >
              Download
            </Button>
          </div>
          <pre className="max-h-[640px] overflow-auto bg-slate-950 p-5 text-xs leading-6 text-slate-100">
            <code>{script.code}</code>
          </pre>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
    </AppShell>
  );
}
