"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Code2, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge, ReadinessBadge } from "@/components/ui/badge";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { sampleTestCases } from "@/lib/sample-data";
import { sampleAutomationAssessments } from "@/lib/phase2-sample-data";
import type { AutomationAssessment, TestCase } from "@/lib/types";

export default function AutomationReadinessPage() {
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [assessments, setAssessments] = useState<AutomationAssessment[]>(sampleAutomationAssessments);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const cases = readJson(appStorageKeys.testCases, sampleTestCases);
    const storedAssessments = readJson(appStorageKeys.automationAssessments, sampleAutomationAssessments);
    setTestCases(cases);
    setAssessments(storedAssessments);
    setSelectedIds(readJson(appStorageKeys.selectedTestCases, cases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Automatable").map((testCase) => testCase.id)));
  }, []);

  const stats = useMemo(() => {
    const total = testCases.length;
    const automatable = testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Automatable").length;
    const needsData = testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Needs API/Data").length;
    const manual = testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Manual Only").length;
    const potential = total ? Math.round(((automatable + needsData) / total) * 100) : 0;
    return { total, automatable, needsData, manual, potential };
  }, [testCases]);

  function persistCases(next: TestCase[]) {
    setTestCases(next);
    writeJson(appStorageKeys.testCases, next);
  }

  function persistAssessments(next: AutomationAssessment[]) {
    setAssessments(next);
    writeJson(appStorageKeys.automationAssessments, next);
  }

  function persistSelection(ids: string[]) {
    setSelectedIds(ids);
    writeJson(appStorageKeys.selectedTestCases, ids);
  }

  async function saveAssessmentsToSupabase(next: AutomationAssessment[]) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      return;
    }
    const ownerId = user.data.user.id;

    await supabase.from("automation_assessments").insert(
      next.map((assessment) => ({
        id: assessment.id,
        owner_id: ownerId,
        test_case_ref: assessment.testCaseId,
        readiness: assessment.readiness,
        confidence_score: assessment.confidenceScore,
        reason: assessment.reason,
        recommended_framework: assessment.recommendedFramework,
        candidate: assessment.readiness !== "Manual Only"
      }))
    );
  }

  async function assess() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/assess-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCases })
      });
      const data = (await response.json().catch(() => ({}))) as { testCases?: TestCase[]; error?: string };

      if (!response.ok || !data.testCases) {
        setMessage(data.error ?? "Automation assessment failed. Check OpenAI quota and runtime logs.");
        return;
      }

      const nextAssessments: AutomationAssessment[] = data.testCases.map((testCase) => ({
        id: `assess-${testCase.id}`,
        testCaseId: testCase.id,
        readiness: testCase.automationStatus ?? testCase.readiness,
        confidenceScore: testCase.readinessConfidence ?? 0.78,
        reason: testCase.readinessReason ?? testCase.automationNotes,
        recommendedFramework: testCase.recommendedFramework ?? ((testCase.automationStatus ?? testCase.readiness) === "Manual Only" ? "Manual" : "Playwright")
      }));
      persistCases(data.testCases);
      persistAssessments(nextAssessments);
      persistSelection(data.testCases.filter((testCase) => (testCase.automationStatus ?? testCase.readiness) === "Automatable").map((testCase) => testCase.id));
      await saveAssessmentsToSupabase(nextAssessments);
      setMessage("Automation readiness scoring completed.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Automation assessment failed.";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    persistSelection([...next]);
  }

  return (
    <AppShell>
      <PageHeader
        title="Automation Readiness"
        description="Score each approved test case for repeatability, required data, validation path, and recommended automation framework."
        actions={
          <>
            <Button onClick={assess} disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}>
              Score Readiness
            </Button>
            <Link href="/code-generation">
              <Button variant="secondary" icon={<Code2 className="size-4" aria-hidden />}>Generate Code</Button>
            </Link>
          </>
        }
      />

      <section className="mb-5 grid gap-4 md:grid-cols-5">
        <Metric label="Total test cases" value={stats.total} />
        <Metric label="Automatable" value={stats.automatable} />
        <Metric label="Needs API/Data" value={stats.needsData} />
        <Metric label="Manual Only" value={stats.manual} />
        <Metric label="Automation potential" value={`${stats.potential}%`} />
      </section>

      {message ? <p className="mb-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

      <div className="mb-4 flex items-center gap-3">
        <Badge tone="blue">{selectedIds.length} automatable cases selected</Badge>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Select</th>
                <th className="px-4 py-3">Test Case</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Recommended Framework</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {testCases.map((testCase) => {
                const assessment = assessments.find((item) => item.testCaseId === testCase.id);
                const readiness = assessment?.readiness ?? testCase.automationStatus ?? testCase.readiness;
                return (
                  <tr key={testCase.id} className="align-top">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                        checked={selectedIds.includes(testCase.id)}
                        disabled={readiness !== "Automatable" || (testCase.approvalStatus ?? testCase.status) === "Rejected"}
                        onChange={() => toggleSelection(testCase.id)}
                        aria-label={`Select ${testCase.testCaseId}`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-brand-blue">{testCase.testCaseId}</p>
                      <p className="mt-1 font-semibold text-slate-950">{testCase.title ?? testCase.name}</p>
                    </td>
                    <td className="px-4 py-4"><ReadinessBadge value={readiness} /></td>
                    <td className="px-4 py-4">{Math.round((assessment?.confidenceScore ?? testCase.readinessConfidence ?? 0.75) * 100)}%</td>
                    <td className="px-4 py-4 text-slate-600">{assessment?.reason ?? testCase.readinessReason ?? testCase.automationNotes}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{assessment?.recommendedFramework ?? testCase.recommendedFramework ?? "Playwright"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
