"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Loader2, Upload, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { getStoredProjectId, isUuid } from "@/lib/project-context";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { TestRun, TestRunResult, TestRunResultStatus } from "@/lib/types";

type ImportPayload = {
  run_name?: string;
  framework?: string;
  total_tests?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  duration_seconds?: number;
  results?: Array<{
    test_case_id?: string;
    test_case_ref?: string;
    title?: string;
    status?: TestRunResultStatus;
    duration_seconds?: number;
    error_message?: string;
  }>;
};

const samplePayload = `{
  "run_name": "Smoke Run",
  "framework": "Playwright",
  "total_tests": 25,
  "passed": 20,
  "failed": 3,
  "skipped": 2,
  "duration_seconds": 145,
  "results": [
    {
      "test_case_ref": "QA-TC-001",
      "title": "Successful User Registration",
      "status": "passed",
      "duration_seconds": 5
    }
  ]
}`;

export default function ExecutionPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [jsonInput, setJsonInput] = useState(samplePayload);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedRuns = readJson<TestRun[]>(appStorageKeys.testRuns, []);
    setRuns(storedRuns);
    setSelectedRunId(storedRuns[0]?.id ?? "");
  }, []);

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0];
  const summary = useMemo(() => {
    const latest = runs[0];
    const totalTests = runs.reduce((total, run) => total + run.totalTests, 0);
    const passed = runs.reduce((total, run) => total + run.passed, 0);
    const failed = runs.reduce((total, run) => total + run.failed, 0);
    const skipped = runs.reduce((total, run) => total + run.skipped, 0);
    const averageDuration = runs.length ? Math.round(runs.reduce((total, run) => total + run.durationSeconds, 0) / runs.length) : 0;

    return {
      totalRuns: runs.length,
      latestStatus: latest ? (latest.failed > 0 ? "Failed" : "Passed") : "No runs",
      passRate: totalTests ? Math.round((passed / totalTests) * 100) : 0,
      failed,
      skipped,
      averageDuration
    };
  }, [runs]);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setJsonInput(await file.text());
    setMessage("Execution JSON loaded. Review and import when ready.");
  }

  async function importRun() {
    setLoading(true);
    setMessage("");
    try {
      const payload = JSON.parse(jsonInput) as ImportPayload;
      const nextRun = normalizeRun(payload);
      await persistRun(nextRun);
      const nextRuns = [nextRun, ...runs];
      setRuns(nextRuns);
      setSelectedRunId(nextRun.id);
      writeJson(appStorageKeys.testRuns, nextRuns);
      setMessage("Execution run imported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Execution results import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Execution"
        description="Track imported automation run status, pass rate, failed tests, skipped tests, and run history for demo-ready execution reporting."
      />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
        <Stat label="Total runs" value={`${summary.totalRuns}`} icon={<Activity className="size-5" aria-hidden />} />
        <Stat label="Latest run status" value={summary.latestStatus} icon={<CheckCircle2 className="size-5" aria-hidden />} />
        <Stat label="Pass rate" value={`${summary.passRate}%`} icon={<CheckCircle2 className="size-5" aria-hidden />} />
        <Stat label="Failed tests" value={`${summary.failed}`} icon={<XCircle className="size-5" aria-hidden />} />
        <Stat label="Skipped tests" value={`${summary.skipped}`} icon={<Clock3 className="size-5" aria-hidden />} />
        <Stat label="Average duration" value={`${summary.averageDuration}s`} icon={<Clock3 className="size-5" aria-hidden />} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="card p-5">
          <h2 className="text-lg font-bold text-slate-950">Import Execution Results</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Upload or paste a JSON result file from Playwright, pytest-bdd, or another automation runner.</p>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Upload JSON results file</span>
            <input className="focus-ring w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" type="file" accept="application/json,.json" onChange={handleFileUpload} />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Paste JSON results</span>
            <Textarea rows={14} value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} />
          </label>
          <Button className="mt-4" onClick={importRun} disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}>
            {loading ? "Importing" : "Import Run"}
          </Button>
          {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        </article>

        <div className="space-y-5">
          <TableCard title="Run History">
            {runs.length ? runs.map((run) => (
              <tr key={run.id} className="table-row cursor-pointer" onClick={() => setSelectedRunId(run.id)}>
                <td className="px-4 py-3 font-semibold text-slate-900">{run.runName}</td>
                <td className="px-4 py-3">{run.framework}</td>
                <td className="px-4 py-3"><Badge tone={run.failed ? "neutral" : "teal"}>{run.failed ? "Failed" : "Passed"}</Badge></td>
                <td className="px-4 py-3 text-slate-600">{run.passed}/{run.totalTests}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(run.executedAt).toLocaleString()}</td>
              </tr>
            )) : (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No execution runs imported yet.</td></tr>
            )}
          </TableCard>

          <TableCard title={selectedRun ? `Results: ${selectedRun.runName}` : "Results"}>
            {selectedRun?.results.length ? selectedRun.results.map((result) => (
              <tr key={result.id} className="table-row">
                <td className="px-4 py-3 font-semibold text-brand-blue">{result.testCaseRef}</td>
                <td className="px-4 py-3 text-slate-900">{result.title}</td>
                <td className="px-4 py-3"><Badge tone={result.status === "passed" ? "teal" : "neutral"}>{result.status}</Badge></td>
                <td className="px-4 py-3 text-slate-600">{result.durationSeconds}s</td>
                <td className="px-4 py-3 text-slate-500">{result.errorMessage ?? "-"}</td>
              </tr>
            )) : (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>Select a run to view results.</td></tr>
            )}
          </TableCard>
        </div>
      </section>
    </AppShell>
  );
}

async function persistRun(run: TestRun) {
  const supabase = createSupabaseBrowserClient();
  const projectId = getStoredProjectId();
  if (!supabase || !projectId) {
    return;
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    return;
  }

  const runResult = await supabase.from("test_runs").insert({
    id: run.id,
    project_id: projectId,
    owner_id: user.data.user.id,
    run_name: run.runName,
    framework: run.framework,
    source: run.source,
    total_tests: run.totalTests,
    passed: run.passed,
    failed: run.failed,
    skipped: run.skipped,
    duration_seconds: run.durationSeconds,
    executed_at: run.executedAt,
    raw_results: run.rawResults
  });

  if (runResult.error) {
    throw new Error(runResult.error.message);
  }

  if (run.results.length) {
    const results = run.results.map((result) => ({
      id: result.id,
      test_run_id: run.id,
      ...(result.testCaseId && isUuid(result.testCaseId) ? { test_case_id: result.testCaseId } : {}),
      test_case_ref: result.testCaseRef,
      title: result.title,
      status: result.status,
      duration_seconds: result.durationSeconds,
      error_message: result.errorMessage
    }));
    const resultsInsert = await supabase.from("test_run_results").insert(results);
    if (resultsInsert.error) {
      throw new Error(resultsInsert.error.message);
    }
  }
}

function normalizeRun(payload: ImportPayload): TestRun {
  const now = new Date().toISOString();
  const results: TestRunResult[] = (payload.results ?? []).map((result) => ({
    id: crypto.randomUUID(),
    testRunId: "",
    testCaseId: result.test_case_id,
    testCaseRef: result.test_case_ref ?? result.test_case_id ?? "UNMAPPED",
    title: result.title ?? "Imported test result",
    status: result.status === "failed" || result.status === "skipped" ? result.status : "passed",
    durationSeconds: Number(result.duration_seconds ?? 0),
    errorMessage: result.error_message,
    createdAt: now
  }));
  const id = crypto.randomUUID();
  const run: TestRun = {
    id,
    projectId: getStoredProjectId(),
    runName: payload.run_name ?? "Imported Run",
    framework: payload.framework ?? "Playwright",
    source: "Manual JSON import",
    totalTests: Number(payload.total_tests ?? results.length),
    passed: Number(payload.passed ?? results.filter((result) => result.status === "passed").length),
    failed: Number(payload.failed ?? results.filter((result) => result.status === "failed").length),
    skipped: Number(payload.skipped ?? results.filter((result) => result.status === "skipped").length),
    durationSeconds: Number(payload.duration_seconds ?? results.reduce((total, result) => total + result.durationSeconds, 0)),
    executedAt: now,
    createdAt: now,
    rawResults: payload,
    results: results.map((result) => ({ ...result, testRunId: id }))
  };
  return run;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <article className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-600">{label}</p>
        <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-brand-blue">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

function TableCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Name / Test</th>
              <th className="px-4 py-3">Framework / Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Count / Duration</th>
              <th className="px-4 py-3">Date / Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </article>
  );
}
