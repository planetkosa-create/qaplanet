"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, GitBranch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge, PriorityBadge, ReadinessBadge, StatusBadge } from "@/components/ui/badge";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { buildCoverageSummary } from "@/lib/coverage";
import type { AnalysisItem, CoverageStatus, GeneratedScript, Priority, RequirementSource, TestCase, TestCaseStatus, TestCaseType, TraceabilityRow } from "@/lib/types";
import { downloadTextFile, traceabilityToCsv } from "@/lib/exports";

const all = "All";

export default function TraceabilityPage() {
  const [rows, setRows] = useState<TraceabilityRow[]>([]);
  const [requirement, setRequirement] = useState(all);
  const [priority, setPriority] = useState<Priority | typeof all>(all);
  const [testType, setTestType] = useState<TestCaseType | typeof all>(all);
  const [automationStatus, setAutomationStatus] = useState(all);
  const [approvalStatus, setApprovalStatus] = useState<TestCaseStatus | typeof all>(all);
  const [coverageStatus, setCoverageStatus] = useState<CoverageStatus | typeof all>(all);

  useEffect(() => {
    const sources = readJson<RequirementSource[]>(appStorageKeys.requirementSources, []);
    const analysisItems = readJson<AnalysisItem[]>(appStorageKeys.analysisItems, []);
    const testCases = readJson<TestCase[]>(appStorageKeys.testCases, []);
    const scripts = readJson<GeneratedScript[]>(appStorageKeys.generatedAutomations, []);
    const generated = buildRows(sources, analysisItems, testCases, scripts);
    setRows(generated);
    writeJson(appStorageKeys.traceabilityRows, generated);
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        return (
          (requirement === all || row.requirementReference === requirement) &&
          (priority === all || row.priority === priority) &&
          (testType === all || row.testType === testType) &&
          (automationStatus === all || row.automationStatus === automationStatus) &&
          (approvalStatus === all || row.approvalStatus === approvalStatus) &&
          (coverageStatus === all || row.coverageStatus === coverageStatus)
        );
      }),
    [approvalStatus, automationStatus, coverageStatus, priority, requirement, rows, testType]
  );

  const coverage = useMemo(() => {
    const total = rows.length;
    const covered = rows.filter((row) => row.coverageStatus === "Covered").length;
    return total ? Math.round((covered / total) * 100) : 0;
  }, [rows]);
  const requirementOptions = [all, ...Array.from(new Set(rows.map((row) => row.requirementReference))).sort()];

  return (
    <AppShell>
      <PageHeader
        title="Traceability"
        description="Link requirement sources to analysis items, test cases, generated automation, export state, and coverage status."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="size-4" aria-hidden />}
              onClick={() => downloadTextFile("qaplanet-traceability.csv", traceabilityToCsv(filtered), "text/csv")}
            >
              Export Matrix
            </Button>
            <Link href="/coverage"><Button icon={<GitBranch className="size-4" aria-hidden />}>Coverage</Button></Link>
          </>
        }
      />

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <Metric label="Traceability rows" value={rows.length} />
        <Metric label="Coverage status" value={`${coverage}%`} />
        <Metric label="Approved cases" value={rows.filter((row) => row.approvalStatus === "Approved").length} />
      </section>

      <section className="card mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Filter label="Requirement" value={requirement} options={requirementOptions} onChange={setRequirement} />
          <Filter label="Priority" value={priority} options={[all, "Critical", "High", "Medium", "Low"]} onChange={(value) => setPriority(value as Priority | typeof all)} />
          <Filter label="Test Type" value={testType} options={[all, "Functional", "Negative", "Edge", "Security", "Integration", "Accessibility", "Performance", "Regression"]} onChange={(value) => setTestType(value as TestCaseType | typeof all)} />
          <Filter label="Automation" value={automationStatus} options={[all, "Automatable", "Needs API/Data", "Manual Only"]} onChange={setAutomationStatus} />
          <Filter label="Approval" value={approvalStatus} options={[all, "Draft", "In Review", "Approved", "Rejected", "Needs Update"]} onChange={(value) => setApprovalStatus(value as TestCaseStatus | typeof all)} />
          <Filter label="Coverage" value={coverageStatus} options={[all, "Covered", "Partial", "Not Covered"]} onChange={(value) => setCoverageStatus(value as CoverageStatus | typeof all)} />
        </div>
      </section>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1680px] text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Requirement ID</th>
                <th className="px-4 py-3">Requirement Title</th>
                <th className="px-4 py-3">Source Document</th>
                <th className="px-4 py-3">Analysis Item</th>
                <th className="px-4 py-3">Test Case ID</th>
                <th className="px-4 py-3">Test Case Title</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Test Type</th>
                <th className="px-4 py-3">Automation Status</th>
                <th className="px-4 py-3">Generated Script</th>
                <th className="px-4 py-3">Approval Status</th>
                <th className="px-4 py-3">Coverage Status</th>
                <th className="px-4 py-3">Export Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length ? (
                filtered.map((row) => (
                  <tr key={`${row.requirementReference}-${row.testCaseId}`} className="table-row">
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-brand-blue">{row.requirementId ?? row.requirementReference}</td>
                    <td className="px-4 py-4 text-slate-700">{row.requirementTitle ?? row.requirementReference}</td>
                    <td className="px-4 py-4 text-slate-700">{row.sourceDocument}</td>
                    <td className="px-4 py-4"><Badge>{row.analysisItem}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-950">{row.testCaseId}</td>
                    <td className="px-4 py-4 text-slate-700">{row.testCaseTitle}</td>
                    <td className="px-4 py-4">{row.priority ? <PriorityBadge value={row.priority} /> : "-"}</td>
                    <td className="px-4 py-4">{row.testType ?? "-"}</td>
                    <td className="px-4 py-4"><ReadinessBadge value={row.automationStatus} /></td>
                    <td className="px-4 py-4 text-slate-700">{row.generatedScript}</td>
                    <td className="px-4 py-4"><StatusBadge value={row.approvalStatus} /></td>
                    <td className="px-4 py-4"><CoverageBadge value={row.coverageStatus ?? "Partial"} /></td>
                    <td className="px-4 py-4"><Badge tone={row.exportStatus === "Exported" ? "teal" : "neutral"}>{row.exportStatus ?? "Not Exported"}</Badge></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={13}>No traceability rows match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function buildRows(
  sources: RequirementSource[],
  analysisItems: AnalysisItem[],
  testCases: TestCase[],
  scripts: GeneratedScript[]
): TraceabilityRow[] {
  const coverage = buildCoverageSummary({ sources, analysisItems, testCases });

  return testCases.map((testCase, index) => {
    const analysisItem =
      analysisItems.find((item) => testCase.analysisItemIds?.includes(item.id)) ?? analysisItems[index % Math.max(analysisItems.length, 1)];
    const source =
      sources.find((item) => testCase.requirementSourceIds?.includes(item.id)) ??
      sources.find((item) => item.id === analysisItem?.requirementSourceId) ??
      sources[0];
    const script = scripts.find((item) => item.testCaseIds.includes(testCase.id) || item.testCaseIds.includes(testCase.testCaseId));
    const coverageRow = coverage.rows.find((row) => row.requirementReference === testCase.requirementReference);

    return {
      requirementId: testCase.requirementReference,
      requirementTitle: coverageRow?.requirementTitle ?? analysisItem?.title ?? testCase.requirementReference,
      requirementReference: testCase.requirementReference,
      sourceDocument: source?.fileName ?? "Unknown source",
      analysisItem: analysisItem?.referenceCode ?? testCase.requirementReference,
      testCaseId: testCase.testCaseId,
      testCaseTitle: testCase.title ?? testCase.name,
      priority: testCase.priority,
      testType: testCase.testType ?? testCase.type,
      automationStatus: testCase.automationStatus ?? testCase.readiness,
      generatedScript: script?.name ?? "Not generated",
      approvalStatus: testCase.approvalStatus ?? testCase.status,
      coverageStatus: coverageRow?.coverageStatus ?? "Partial",
      exportStatus: "Not Exported"
    };
  });
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
    </div>
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

function CoverageBadge({ value }: { value: CoverageStatus }) {
  if (value === "Covered") {
    return <Badge tone="teal">Covered</Badge>;
  }
  if (value === "Partial") {
    return <Badge tone="blue">Partial</Badge>;
  }
  return <Badge>Not Covered</Badge>;
}
