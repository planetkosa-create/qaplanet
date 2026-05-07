"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, GitBranch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge, ReadinessBadge, StatusBadge } from "@/components/ui/badge";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { sampleTestCases } from "@/lib/sample-data";
import { buildSampleTraceability, sampleAnalysisItems, sampleGeneratedAutomations, sampleRequirementSources } from "@/lib/phase2-sample-data";
import type { AnalysisItem, GeneratedScript, RequirementSource, TestCase, TraceabilityRow } from "@/lib/types";
import { downloadTextFile, traceabilityToCsv } from "@/lib/exports";

export default function TraceabilityPage() {
  const [rows, setRows] = useState<TraceabilityRow[]>(buildSampleTraceability());

  useEffect(() => {
    const sources = readJson(appStorageKeys.requirementSources, sampleRequirementSources);
    const analysisItems = readJson(appStorageKeys.analysisItems, sampleAnalysisItems);
    const testCases = readJson(appStorageKeys.testCases, sampleTestCases);
    const scripts = readJson(appStorageKeys.generatedAutomations, sampleGeneratedAutomations);
    const generated = buildRows(sources, analysisItems, testCases, scripts);
    setRows(generated);
    writeJson(appStorageKeys.traceabilityRows, generated);
  }, []);

  const coverage = useMemo(() => {
    const total = rows.length;
    const automated = rows.filter((row) => row.generatedScript !== "Not generated").length;
    return total ? Math.round((automated / total) * 100) : 0;
  }, [rows]);

  return (
    <AppShell>
      <PageHeader
        title="Traceability"
        description="Link each requirement source to extracted analysis items, generated test cases, automation status, scripts, and approval state."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="size-4" aria-hidden />}
              onClick={() => downloadTextFile("qaplanet-traceability.csv", traceabilityToCsv(rows), "text/csv")}
            >
              Export Matrix
            </Button>
            <Link href="/export-center"><Button icon={<GitBranch className="size-4" aria-hidden />}>Export Center</Button></Link>
          </>
        }
      />

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">Traceability rows</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{rows.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">Automation coverage</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{coverage}%</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">Approved cases</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{rows.filter((row) => row.approvalStatus === "Approved").length}</p>
        </div>
      </section>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Requirement Reference</th>
                <th className="px-4 py-3">Source Document</th>
                <th className="px-4 py-3">Analysis Item</th>
                <th className="px-4 py-3">Test Case ID</th>
                <th className="px-4 py-3">Test Case Title</th>
                <th className="px-4 py-3">Automation Status</th>
                <th className="px-4 py-3">Generated Script</th>
                <th className="px-4 py-3">Approval Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.requirementReference}-${row.testCaseId}`}>
                  <td className="px-4 py-4 font-semibold text-brand-blue">{row.requirementReference}</td>
                  <td className="px-4 py-4 text-slate-700">{row.sourceDocument}</td>
                  <td className="px-4 py-4"><Badge>{row.analysisItem}</Badge></td>
                  <td className="px-4 py-4 font-semibold text-slate-950">{row.testCaseId}</td>
                  <td className="px-4 py-4 text-slate-700">{row.testCaseTitle}</td>
                  <td className="px-4 py-4"><ReadinessBadge value={row.automationStatus} /></td>
                  <td className="px-4 py-4 text-slate-700">{row.generatedScript}</td>
                  <td className="px-4 py-4"><StatusBadge value={row.approvalStatus} /></td>
                </tr>
              ))}
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
  return testCases.map((testCase, index) => {
    const analysisItem =
      analysisItems.find((item) => testCase.analysisItemIds?.includes(item.id)) ?? analysisItems[index % Math.max(analysisItems.length, 1)];
    const source =
      sources.find((item) => testCase.requirementSourceIds?.includes(item.id)) ??
      sources.find((item) => item.id === analysisItem?.requirementSourceId) ??
      sources[0];
    const script = scripts.find((item) => item.testCaseIds.includes(testCase.id));

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
