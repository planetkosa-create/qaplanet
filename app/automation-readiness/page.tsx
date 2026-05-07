"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Code2, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge, ReadinessBadge } from "@/components/ui/badge";
import { TestCaseTable } from "@/components/test-case-table";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { sampleTestCases } from "@/lib/sample-data";
import type { TestCase } from "@/lib/types";

export default function AutomationReadinessPage() {
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const cases = readJson(appStorageKeys.testCases, sampleTestCases);
    setTestCases(cases);
    setSelectedIds(readJson(appStorageKeys.selectedTestCases, cases.filter((testCase) => testCase.readiness === "Automatable").map((testCase) => testCase.id)));
  }, []);

  const counts = useMemo(() => {
    return {
      automatable: testCases.filter((testCase) => testCase.readiness === "Automatable").length,
      needsData: testCases.filter((testCase) => testCase.readiness === "Needs API/Data").length,
      manual: testCases.filter((testCase) => testCase.readiness === "Manual Only").length
    };
  }, [testCases]);

  function persistSelection(ids: string[]) {
    setSelectedIds(ids);
    writeJson(appStorageKeys.selectedTestCases, ids);
  }

  function persistCases(next: TestCase[]) {
    setTestCases(next);
    writeJson(appStorageKeys.testCases, next);
  }

  async function assess() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/ai/assess-automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testCases })
    });
    const data = (await response.json()) as { testCases?: TestCase[]; error?: string };
    setLoading(false);

    if (!response.ok || !data.testCases) {
      setMessage(data.error ?? "Automation assessment failed. Check your OpenAI API key.");
      return;
    }

    persistCases(data.testCases);
    const automatable = data.testCases.filter((testCase) => testCase.readiness === "Automatable").map((testCase) => testCase.id);
    persistSelection(automatable);
    setMessage("Automation readiness updated.");
  }

  return (
    <AppShell>
      <PageHeader
        title="Automation Readiness"
        description="Classify each test case as automatable, needs API or data support, or manual only. Select the cases that should become Playwright scripts."
        actions={
          <>
            <Button onClick={assess} disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}>
              Reassess
            </Button>
            <Link href="/code-generation">
              <Button variant="secondary" icon={<Code2 className="size-4" aria-hidden />}>Generate Code</Button>
            </Link>
          </>
        }
      />

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">Automatable</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{counts.automatable}</p>
          <div className="mt-3"><ReadinessBadge value="Automatable" /></div>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">Needs API/Data</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{counts.needsData}</p>
          <div className="mt-3"><ReadinessBadge value="Needs API/Data" /></div>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">Manual Only</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{counts.manual}</p>
          <div className="mt-3"><ReadinessBadge value="Manual Only" /></div>
        </div>
      </section>

      {message ? <p className="mb-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

      <div className="mb-4 flex items-center gap-3">
        <Badge tone="blue">{selectedIds.length} selected for code generation</Badge>
      </div>
      <TestCaseTable
        testCases={testCases}
        onChange={persistCases}
        selectable
        selectedIds={selectedIds}
        onSelectedChange={persistSelection}
      />
    </AppShell>
  );
}
