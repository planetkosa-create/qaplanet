"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, GitBranch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/StatCard";
import { appStorageKeys, readJson } from "@/lib/storage";
import { buildCoverageSummary } from "@/lib/coverage";
import { downloadWorkbook } from "@/lib/exports";
import type { AnalysisItem, RequirementSource, TestCase } from "@/lib/types";

export default function CoveragePage() {
  const [sources, setSources] = useState<RequirementSource[]>([]);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  useEffect(() => {
    setSources(readJson(appStorageKeys.requirementSources, []));
    setAnalysisItems(readJson(appStorageKeys.analysisItems, []));
    setTestCases(readJson(appStorageKeys.testCases, []));
  }, []);

  const coverage = useMemo(() => buildCoverageSummary({ sources, analysisItems, testCases }), [analysisItems, sources, testCases]);

  async function exportCoverage() {
    await downloadWorkbook(
      {
        Coverage: coverage.rows.map((row) => ({
          "Requirement Reference": row.requirementReference,
          "Requirement Title": row.requirementTitle,
          "Test Case Count": row.testCaseCount,
          "Approved Count": row.approvedCount,
          "Automation Count": row.automationCount,
          "Coverage Status": row.coverageStatus
        }))
      },
      "qaplanet-coverage-dashboard.xlsx"
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Coverage"
        description="Measure requirement coverage, approval progress, automation potential, risks, and gaps for the active project."
        actions={
          <>
            <Button variant="secondary" onClick={exportCoverage} icon={<Download className="size-4" aria-hidden />}>Export Coverage</Button>
            <Link href="/traceability"><Button icon={<GitBranch className="size-4" aria-hidden />}>Traceability</Button></Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Requirements" value={coverage.totalRequirements} />
        <StatCard label="Requirements Covered" value={coverage.requirementsCovered} />
        <StatCard label="Requirements Without Test Cases" value={coverage.requirementsWithoutTestCases} />
        <StatCard label="Total Test Cases" value={coverage.totalTestCases} />
        <StatCard label="Approved Test Cases" value={coverage.approvedTestCases} />
        <StatCard label="Automatable" value={coverage.automatable} />
        <StatCard label="Needs API/Data" value={coverage.needsApiData} />
        <StatCard label="Manual Only" value={coverage.manualOnly} />
        <StatCard label="Risks" value={coverage.risks} />
        <StatCard label="Gaps" value={coverage.gaps} />
      </section>

      <div className="card mt-5 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-700">Coverage Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Requirement Reference</th>
                <th className="px-4 py-3">Requirement Title</th>
                <th className="px-4 py-3">Test Case Count</th>
                <th className="px-4 py-3">Approved Count</th>
                <th className="px-4 py-3">Automation Count</th>
                <th className="px-4 py-3">Coverage Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coverage.rows.length ? (
                coverage.rows.map((row) => (
                  <tr key={row.requirementReference} className="table-row">
                    <td className="whitespace-nowrap px-4 py-4 font-bold text-brand-blue">{row.requirementReference}</td>
                    <td className="px-4 py-4 text-slate-700">{row.requirementTitle}</td>
                    <td className="px-4 py-4">{row.testCaseCount}</td>
                    <td className="px-4 py-4">{row.approvedCount}</td>
                    <td className="px-4 py-4">{row.automationCount}</td>
                    <td className="px-4 py-4"><CoverageBadge value={row.coverageStatus} /></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No requirements or test cases are available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function CoverageBadge({ value }: { value: "Covered" | "Partial" | "Not Covered" }) {
  if (value === "Covered") {
    return <Badge tone="teal">Covered</Badge>;
  }
  if (value === "Partial") {
    return <Badge tone="blue">Partial</Badge>;
  }
  return <Badge>Not Covered</Badge>;
}
