"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, RefreshCw, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PriorityBadge, ReadinessBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/field";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { sampleTestCases } from "@/lib/sample-data";
import { sampleAnalysisItems, sampleRequirementSources } from "@/lib/phase2-sample-data";
import type { AnalysisItem, Priority, TestCase, TestCaseStatus, TestCaseType } from "@/lib/types";

const all = "All";

export default function TestCasesPage() {
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>(sampleAnalysisItems);
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [priority, setPriority] = useState<Priority | typeof all>(all);
  const [type, setType] = useState<TestCaseType | typeof all>(all);
  const [candidate, setCandidate] = useState<"All" | "Yes" | "No">("All");
  const [approval, setApproval] = useState<TestCaseStatus | typeof all>(all);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAnalysisItems(readJson(appStorageKeys.analysisItems, sampleAnalysisItems));
    setTestCases(readJson(appStorageKeys.testCases, sampleTestCases));
  }, []);

  const filtered = useMemo(() => {
    return testCases.filter((testCase) => {
      return (
        (priority === all || testCase.priority === priority) &&
        (type === all || testCase.type === type) &&
        (candidate === "All" || (candidate === "Yes" ? testCase.automationCandidate : !testCase.automationCandidate)) &&
        (approval === all || (testCase.approvalStatus ?? testCase.status) === approval)
      );
    });
  }, [approval, candidate, priority, testCases, type]);

  function persist(next: TestCase[]) {
    setTestCases(next);
    writeJson(appStorageKeys.testCases, next);
  }

  async function saveTestCasesToSupabase(nextCases: TestCase[]) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      return;
    }
    const ownerId = user.data.user.id;

    await supabase.from("test_cases").insert(
      nextCases.map((testCase) => ({
        id: testCase.id,
        owner_id: ownerId,
        test_case_id: testCase.testCaseId,
        requirement_reference: testCase.requirementReference,
        name: testCase.name,
        title: testCase.title ?? testCase.name,
        description: testCase.description,
        preconditions: testCase.preconditions,
        steps: testCase.steps,
        expected_result: testCase.expectedResult,
        priority: testCase.priority,
        type: testCase.type,
        test_type: testCase.testType ?? testCase.type,
        automation_candidate: testCase.automationCandidate,
        automation_status: testCase.automationStatus ?? testCase.readiness,
        automation_notes: testCase.automationNotes,
        readiness: testCase.readiness,
        status: testCase.status,
        approval_status: testCase.approvalStatus ?? testCase.status,
        analysis_item_ids: testCase.analysisItemIds ?? [],
        requirement_source_ids: testCase.requirementSourceIds ?? []
      }))
    );
  }

  async function generate() {
    const confirmed = testCases.length === 0 || window.confirm("Regenerate test cases from the latest analysis items?");
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const sources = readJson(appStorageKeys.requirementSources, sampleRequirementSources);
      const response = await fetch("/api/ai/generate-test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources, analysisItems })
      });
      const data = (await response.json().catch(() => ({}))) as { testCases?: TestCase[]; error?: string };

      if (!response.ok || !data.testCases) {
        setMessage(data.error ?? "Test case generation failed. Check OpenAI quota and runtime logs.");
        return;
      }

      persist(data.testCases);
      await saveTestCasesToSupabase(data.testCases);
      setMessage("Generated structured test cases with requirement traceability.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Test case generation failed.";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function updateCase(id: string, patch: Partial<TestCase>) {
    persist(testCases.map((testCase) => (testCase.id === id ? { ...testCase, ...patch } : testCase)));
  }

  return (
    <AppShell>
      <PageHeader
        title="Test Case Generator"
        description="Generate, filter, inspect, edit, approve, reject, and regenerate QA test cases from analysis items and requirement sources."
        actions={
          <>
            <Button onClick={generate} disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}>
              Generate Test Cases
            </Button>
            <Link href="/automation-readiness">
              <Button variant="secondary" icon={<Send className="size-4" aria-hidden />}>Assess Automation</Button>
            </Link>
          </>
        }
      />

      <section className="card mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Filter label="Priority" value={priority} options={[all, "Critical", "High", "Medium", "Low"]} onChange={(value) => setPriority(value as Priority | typeof all)} />
          <Filter label="Type" value={type} options={[all, "Functional", "Negative", "Edge", "Validation", "Security", "Role-based", "Integration", "Regression"]} onChange={(value) => setType(value as TestCaseType | typeof all)} />
          <Filter label="Automation candidate" value={candidate} options={["All", "Yes", "No"]} onChange={(value) => setCandidate(value as "All" | "Yes" | "No")} />
          <Filter label="Approval status" value={approval} options={[all, "Draft", "Approved", "Rejected"]} onChange={(value) => setApproval(value as TestCaseStatus | typeof all)} />
        </div>
      </section>

      {message ? <p className="mb-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

      {filtered.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Requirement</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Automation</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((testCase) => (
                  <tr key={testCase.id} className="align-top">
                    <td className="px-4 py-4 font-semibold text-brand-blue">{testCase.testCaseId}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{testCase.title ?? testCase.name}</p>
                      <p className="mt-1 line-clamp-2 text-slate-600">{testCase.description}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{testCase.requirementReference}</td>
                    <td className="px-4 py-4"><PriorityBadge value={testCase.priority} /></td>
                    <td className="px-4 py-4">{testCase.testType ?? testCase.type}</td>
                    <td className="px-4 py-4"><ReadinessBadge value={testCase.automationStatus ?? testCase.readiness} /></td>
                    <td className="px-4 py-4"><StatusBadge value={testCase.approvalStatus ?? testCase.status} /></td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" className="min-h-9 px-3 py-1.5" onClick={() => setSelectedCase(testCase)} icon={<Eye className="size-4" aria-hidden />}>View</Button>
                        <Button variant="secondary" className="min-h-9 px-3 py-1.5" onClick={() => updateCase(testCase.id, { status: "Approved", approvalStatus: "Approved" })}>Approve</Button>
                        <Button variant="secondary" className="min-h-9 px-3 py-1.5" onClick={() => updateCase(testCase.id, { status: "Rejected", approvalStatus: "Rejected" })}>Reject</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState title="No matching test cases" description="Adjust filters or generate test cases from the latest analysis items." action={<Button onClick={generate}>Generate Test Cases</Button>} />
      )}

      {selectedCase ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-3xl overflow-auto p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-blue">{selectedCase.testCaseId}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedCase.title ?? selectedCase.name}</h2>
              </div>
              <Button variant="ghost" onClick={() => setSelectedCase(null)}>Close</Button>
            </div>
            <div className="mt-5 grid gap-4">
              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-700">Title</span>
                <Input value={selectedCase.title ?? selectedCase.name} onChange={(event) => setSelectedCase({ ...selectedCase, title: event.target.value, name: event.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-700">Description</span>
                <Textarea rows={4} value={selectedCase.description} onChange={(event) => setSelectedCase({ ...selectedCase, description: event.target.value })} />
              </label>
              <div className="rounded-md bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">Steps</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                  {selectedCase.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
              <p className="text-sm text-slate-600"><strong>Expected result:</strong> {selectedCase.expectedResult}</p>
              <p className="text-sm text-slate-600"><strong>Automation notes:</strong> {selectedCase.automationNotes}</p>
              <Button onClick={() => { updateCase(selectedCase.id, selectedCase); setSelectedCase(null); }}>Save Changes</Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select className="focus-ring min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}
