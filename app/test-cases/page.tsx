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
import { getStoredProjectId } from "@/lib/project-context";
import { sampleTestCases } from "@/lib/sample-data";
import { sampleAnalysisItems, sampleRequirementSources } from "@/lib/phase2-sample-data";
import type { AnalysisItem, AutomationReadiness, Priority, TestCase, TestCaseStatus, TestCaseType } from "@/lib/types";

const all = "All";
const pageSize = 10;
const coverageAreas = [
  "Registration validation",
  "Login and account lockout",
  "Role-based access control",
  "Draft creation and duplicate draft prevention",
  "Required field validation",
  "Application save and resume",
  "Document upload validation",
  "Required document enforcement",
  "Application submission",
  "Read-only submitted applications",
  "Application status visibility",
  "Withdrawal rules",
  "Reviewer queue filtering and sorting",
  "Reviewer status updates",
  "Administrator configuration",
  "Audit history",
  "Notification triggers",
  "Accessibility checks",
  "Performance checks",
  "Security checks"
];
type GenerationMode = "replace" | "append";
type GenerateResponse = {
  success?: boolean;
  count?: number;
  test_cases?: unknown;
  testCases?: unknown;
  generatedTestCases?: unknown;
  error?: string;
};

export default function TestCasesPage() {
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>(sampleAnalysisItems);
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [priority, setPriority] = useState<Priority | typeof all>(all);
  const [type, setType] = useState<TestCaseType | typeof all>(all);
  const [candidate, setCandidate] = useState<"All" | "Yes" | "No">("All");
  const [approval, setApproval] = useState<TestCaseStatus | typeof all>(all);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("replace");
  const [page, setPage] = useState(1);
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

  const coverageSummary = useMemo(() => buildCoverageSummary(testCases), [testCases]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleCases = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [approval, candidate, priority, type, testCases.length]);

  function persist(next: TestCase[]) {
    setTestCases(next);
    writeJson(appStorageKeys.testCases, next);
  }

  async function fetchProjectTestCasesFromSupabase() {
    const supabase = createSupabaseBrowserClient();
    const projectId = getStoredProjectId();
    if (!supabase || !projectId) {
      return null;
    }

    const result = await supabase
      .from("test_cases")
      .select("*")
      .eq("project_id", projectId)
      .order("test_case_id", { ascending: true });

    if (result.error) {
      throw new Error(`Failed to refresh generated test cases: ${result.error.message}`);
    }

    return Array.isArray(result.data) ? result.data.map(rowToTestCase) : [];
  }

  async function getAccessToken() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return undefined;
    }

    const session = await supabase.auth.getSession();
    return session.data.session?.access_token;
  }

  async function generate() {
    const confirmed =
      generationMode === "append" ||
      testCases.length === 0 ||
      window.confirm("Replace existing test cases for this project with a newly generated set?");
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const sources = readJson(appStorageKeys.requirementSources, sampleRequirementSources);
      const safeSources = Array.isArray(sources) ? sources : [];
      const safeAnalysisItems = Array.isArray(analysisItems) ? analysisItems : [];
      const projectId = getStoredProjectId();
      const accessToken = await getAccessToken();
      const response = await fetch("/api/ai/generate-test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: safeSources,
          analysisItems: safeAnalysisItems,
          projectId,
          accessToken,
          generationMode,
          startNumber: generationMode === "append" ? nextTestCaseNumber(testCases) : 1
        })
      });
      const result = (await response.json().catch(() => ({}))) as GenerateResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to generate test cases.");
      }

      const generated = normalizeGeneratedTestCases(result);
      if (generated.length === 0) {
        throw new Error("Generation completed but no test cases were saved.");
      }

      const refreshedCases = await fetchProjectTestCasesFromSupabase();
      const generatedCases = refreshedCases ?? generated;
      const nextCases = generationMode === "append" && !refreshedCases ? [...testCases, ...generatedCases] : generatedCases;
      persist(nextCases);
      const coverageCount = buildCoverageSummary(nextCases).areas.length;
      setPage(1);
      setMessage(`Generated ${generated.length} test cases across ${coverageCount} coverage areas.`);
    } catch (error) {
      console.error("Failed to generate test cases:", error);
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
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Generation mode</h2>
            <p className="mt-1 text-sm text-slate-600">Choose whether newly generated cases replace the current set or continue the numbering.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="focus-within:ring-brand-blue/20 flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm focus-within:ring-4">
              <input type="radio" className="mt-1" checked={generationMode === "replace"} onChange={() => setGenerationMode("replace")} />
              <span>
                <span className="block font-semibold text-slate-950">Replace existing</span>
                <span className="block text-xs leading-5 text-slate-600">Delete current project test cases before saving the new set.</span>
              </span>
            </label>
            <label className="focus-within:ring-brand-blue/20 flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm focus-within:ring-4">
              <input type="radio" className="mt-1" checked={generationMode === "append"} onChange={() => setGenerationMode("append")} />
              <span>
                <span className="block font-semibold text-slate-950">Append new</span>
                <span className="block text-xs leading-5 text-slate-600">Keep current cases and continue from the latest QA-TC number.</span>
              </span>
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Filter label="Priority" value={priority} options={[all, "Critical", "High", "Medium", "Low"]} onChange={(value) => setPriority(value as Priority | typeof all)} />
          <Filter label="Type" value={type} options={[all, "Functional", "Negative", "Edge", "Security", "Integration", "Accessibility", "Performance", "Regression"]} onChange={(value) => setType(value as TestCaseType | typeof all)} />
          <Filter label="Automation candidate" value={candidate} options={["All", "Yes", "No"]} onChange={(value) => setCandidate(value as "All" | "Yes" | "No")} />
          <Filter label="Approval status" value={approval} options={[all, "Draft", "Approved", "Rejected"]} onChange={(value) => setApproval(value as TestCaseStatus | typeof all)} />
        </div>
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">Total generated test cases</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{testCases.length}</p>
          <p className="mt-2 text-sm text-slate-600">{filtered.length} visible with current filters</p>
        </div>

        <div className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Coverage Summary</h2>
              <p className="mt-1 text-sm text-slate-600">
                {coverageSummary.areas.length} coverage areas represented across {coverageSummary.typeEntries.length} test types.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-blue">{coverageSummary.areas.length} areas</span>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">By type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {coverageSummary.typeEntries.map(([entryType, count]) => (
                  <span key={entryType} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{entryType}: {count}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirement areas</p>
              <div className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-auto">
                {coverageSummary.areas.map((area) => (
                  <span key={area} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-brand-teal">{area}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {message ? <p className="mb-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

      {testCases.length === 0 ? (
        <EmptyState title="No test cases generated yet" description="Generate test cases from the latest analysis items and requirement sources." action={<Button onClick={generate}>Generate Test Cases</Button>} />
      ) : filtered.length ? (
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
                {visibleCases.map((testCase) => (
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
          {filtered.length > pageSize ? (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
                <Button variant="secondary" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState title="No matching test cases" description="Adjust filters to review the generated test cases." />
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
                  {(Array.isArray(selectedCase.steps) ? selectedCase.steps : []).map((step) => <li key={step}>{step}</li>)}
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

function normalizeGeneratedTestCases(payload: unknown): TestCase[] {
  const raw = payload as { test_cases?: unknown; testCases?: unknown; generatedTestCases?: unknown } | unknown[];

  const cases = Array.isArray((raw as { test_cases?: unknown }).test_cases)
    ? (raw as { test_cases: unknown[] }).test_cases
    : Array.isArray((raw as { testCases?: unknown }).testCases)
      ? (raw as { testCases: unknown[] }).testCases
      : Array.isArray((raw as { generatedTestCases?: unknown }).generatedTestCases)
        ? (raw as { generatedTestCases: unknown[] }).generatedTestCases
        : Array.isArray(raw)
          ? raw
          : [];

  return cases.map((item: unknown, index: number) => {
    const record = item as Record<string, unknown>;
    const type = normalizeType(record.test_type ?? record.testType ?? record.type);
    const readiness = normalizeReadiness(record.automation_status ?? record.automationStatus ?? record.readiness);
    const status = normalizeStatus(record.approval_status ?? record.approvalStatus ?? record.status);
    const title = stringValue(record.title) || stringValue(record.name) || `Generated Test Case ${index + 1}`;

    return {
      id: stringValue(record.id) || crypto.randomUUID(),
      testCaseId: stringValue(record.test_case_id) || stringValue(record.testCaseId) || `QA-TC-${String(index + 1).padStart(3, "0")}`,
      requirementReference: stringValue(record.requirement_reference) || stringValue(record.requirementReference) || "UNMAPPED",
      title,
      name: title,
      description: stringValue(record.description),
      preconditions: stringValue(record.preconditions),
      steps: Array.isArray(record.steps) ? record.steps.map(String) : [],
      expectedResult: stringValue(record.expected_result) || stringValue(record.expectedResult),
      priority: normalizePriority(record.priority),
      type,
      testType: type,
      automationCandidate:
        typeof record.automation_candidate === "boolean"
          ? record.automation_candidate
          : typeof record.automationCandidate === "boolean"
            ? record.automationCandidate
            : readiness === "Automatable",
      readiness,
      automationStatus: readiness,
      automationNotes: stringValue(record.automation_notes) || stringValue(record.automationNotes),
      status,
      approvalStatus: status,
      analysisItemIds: Array.isArray(record.analysis_item_ids) ? record.analysis_item_ids.map(String) : Array.isArray(record.analysisItemIds) ? record.analysisItemIds.map(String) : [],
      requirementSourceIds: Array.isArray(record.requirement_source_ids)
        ? record.requirement_source_ids.map(String)
        : Array.isArray(record.requirementSourceIds)
          ? record.requirementSourceIds.map(String)
          : []
    };
  });
}

function rowToTestCase(row: Record<string, unknown>): TestCase {
  return normalizeGeneratedTestCases([row])[0] ?? {
    id: crypto.randomUUID(),
    testCaseId: "QA-TC-001",
    name: "Generated test case",
    title: "Generated test case",
    description: "",
    preconditions: "",
    steps: [],
    expectedResult: "",
    priority: "Medium",
    type: "Functional",
    testType: "Functional",
    requirementReference: "UNMAPPED",
    automationCandidate: false,
    automationNotes: "",
    readiness: "Manual Only",
    automationStatus: "Manual Only",
    status: "Draft",
    approvalStatus: "Draft",
    analysisItemIds: [],
    requirementSourceIds: []
  };
}

function nextTestCaseNumber(testCases: TestCase[]) {
  const latest = testCases.reduce((max, testCase) => {
    const match = testCase.testCaseId.match(/QA-TC-(\d+)/i);
    const value = match ? Number.parseInt(match[1] ?? "0", 10) : 0;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  return latest + 1;
}

function normalizePriority(value: unknown): Priority {
  return ["Critical", "High", "Medium", "Low"].includes(String(value)) ? (value as Priority) : "Medium";
}

function normalizeType(value: unknown): TestCaseType {
  const candidate = String(value);
  if (["Functional", "Negative", "Edge", "Security", "Integration", "Accessibility", "Performance", "Regression"].includes(candidate)) {
    return candidate as TestCaseType;
  }
  if (candidate === "Validation") return "Edge";
  if (candidate === "Role-based") return "Security";
  return "Functional";
}

function normalizeReadiness(value: unknown): AutomationReadiness {
  const candidate = String(value);
  return ["Automatable", "Needs API/Data", "Manual Only"].includes(candidate) ? (candidate as AutomationReadiness) : "Manual Only";
}

function normalizeStatus(value: unknown): TestCaseStatus {
  const candidate = String(value);
  return ["Draft", "Approved", "Rejected"].includes(candidate) ? (candidate as TestCaseStatus) : "Draft";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function renumberTestCases(testCases: TestCase[], startNumber: number) {
  return testCases.map((testCase, index) => ({
    ...testCase,
    testCaseId: `QA-TC-${String(startNumber + index).padStart(3, "0")}`,
    status: "Draft" as TestCaseStatus,
    approvalStatus: "Draft" as TestCaseStatus
  }));
}

function buildCoverageSummary(testCases: TestCase[]) {
  const byType = new Map<string, number>();
  const areaSet = new Set<string>();

  for (const testCase of testCases) {
    const entryType = testCase.testType ?? testCase.type;
    byType.set(entryType, (byType.get(entryType) ?? 0) + 1);

    const searchable = `${testCase.requirementReference} ${testCase.title ?? testCase.name} ${testCase.description}`.toLowerCase();
    const matched = coverageAreas.filter((area) => searchable.includes(area.toLowerCase().replace(" checks", "").replace(" validation", "")));

    if (matched.length) {
      matched.forEach((area) => areaSet.add(area));
    } else if (testCase.requirementReference) {
      areaSet.add(testCase.requirementReference);
    }
  }

  return {
    typeEntries: [...byType.entries()].sort(([a], [b]) => a.localeCompare(b)),
    areas: [...areaSet].sort((a, b) => a.localeCompare(b))
  };
}
