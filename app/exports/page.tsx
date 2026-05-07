"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { appStorageKeys, readJson } from "@/lib/storage";
import { sampleTestCases } from "@/lib/sample-data";
import { buildSampleTraceability, sampleAnalysisItems, sampleAutomationAssessments } from "@/lib/phase2-sample-data";
import type { AnalysisItem, AutomationAssessment, TestCase, TraceabilityRow } from "@/lib/types";
import {
  analysisItemsToCsv,
  downloadTextFile,
  downloadWorkbook,
  itemsToMarkdown,
  readinessToCsv,
  testCasesToCsv,
  testCasesToMarkdown,
  traceabilityToCsv
} from "@/lib/exports";

type ExportScope = "Test cases" | "Analysis items" | "Automation readiness" | "Traceability matrix";
type ExportFormat = "CSV" | "Markdown" | "JSON" | "Excel";

export default function ExportsPage() {
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>(sampleAnalysisItems);
  const [readiness, setReadiness] = useState<AutomationAssessment[]>(sampleAutomationAssessments);
  const [traceability, setTraceability] = useState<TraceabilityRow[]>(buildSampleTraceability());
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTestCases(readJson(appStorageKeys.testCases, sampleTestCases));
    setAnalysisItems(readJson(appStorageKeys.analysisItems, sampleAnalysisItems));
    setReadiness(readJson(appStorageKeys.automationAssessments, sampleAutomationAssessments));
    setTraceability(readJson("qaplanet.traceabilityRows", buildSampleTraceability()));
  }, []);

  const counts = useMemo(
    () => ({
      "Test cases": testCases.length,
      "Analysis items": analysisItems.length,
      "Automation readiness": readiness.length,
      "Traceability matrix": traceability.length
    }),
    [analysisItems.length, readiness.length, testCases.length, traceability.length]
  );

  async function exportData(scope: ExportScope, format: ExportFormat) {
    const fileBase = `qaplanet-${scope.toLowerCase().replaceAll(" ", "-")}`;
    const rows = rowsForScope(scope, { testCases, analysisItems, readiness, traceability });

    if (format === "CSV") {
      const content =
        scope === "Test cases"
          ? testCasesToCsv(testCases)
          : scope === "Analysis items"
            ? analysisItemsToCsv(analysisItems)
            : scope === "Automation readiness"
              ? readinessToCsv(readiness)
              : traceabilityToCsv(traceability);
      downloadTextFile(`${fileBase}.csv`, content, "text/csv");
    }

    if (format === "Markdown") {
      const content = scope === "Test cases" ? testCasesToMarkdown(testCases) : itemsToMarkdown(scope, rows);
      downloadTextFile(`${fileBase}.md`, content, "text/markdown");
    }

    if (format === "JSON") {
      downloadTextFile(`${fileBase}.json`, JSON.stringify(rows, null, 2), "application/json");
    }

    if (format === "Excel") {
      await downloadWorkbook({ [scope]: rows }, `${fileBase}.xlsx`);
    }

    setMessage(`${scope} exported as ${format}.`);
  }

  return (
    <AppShell>
      <PageHeader
        title="Export Center"
        description="Export QA deliverables for review, audit, test management import, automation handoff, and traceability reporting."
      />

      <section className="grid gap-5 xl:grid-cols-2">
        {(["Test cases", "Analysis items", "Automation readiness", "Traceability matrix"] as ExportScope[]).map((scope) => (
          <article key={scope} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {iconForScope(scope)}
                  <h2 className="text-lg font-semibold text-slate-950">{scope}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{descriptionForScope(scope)}</p>
              </div>
              <Badge tone="teal">{counts[scope]} rows</Badge>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(["CSV", "Markdown", "JSON", "Excel"] as ExportFormat[]).map((format) => (
                <Button key={format} variant="secondary" onClick={() => exportData(scope, format)} icon={<Download className="size-4" aria-hidden />}>
                  {format}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </section>

      {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
    </AppShell>
  );
}

function rowsForScope(
  scope: ExportScope,
  data: {
    testCases: TestCase[];
    analysisItems: AnalysisItem[];
    readiness: AutomationAssessment[];
    traceability: TraceabilityRow[];
  }
): Record<string, string | number | boolean>[] {
  if (scope === "Test cases") {
    return data.testCases.map((testCase) => ({
      test_case_id: testCase.testCaseId,
      title: testCase.title ?? testCase.name,
      requirement_reference: testCase.requirementReference,
      priority: testCase.priority,
      type: testCase.testType ?? testCase.type,
      automation_status: testCase.automationStatus ?? testCase.readiness,
      approval_status: testCase.approvalStatus ?? testCase.status
    }));
  }
  if (scope === "Analysis items") {
    return data.analysisItems.map((item) => ({
      reference_code: item.referenceCode,
      item_type: item.itemType,
      title: item.title,
      description: item.description,
      confidence_score: item.confidenceScore
    }));
  }
  if (scope === "Automation readiness") {
    return data.readiness.map((item) => ({
      test_case_id: item.testCaseId,
      readiness: item.readiness,
      confidence_score: item.confidenceScore,
      reason: item.reason,
      recommended_framework: item.recommendedFramework
    }));
  }
  return data.traceability.map((row) => ({
    requirement_reference: row.requirementReference,
    source_document: row.sourceDocument,
    analysis_item: row.analysisItem,
    test_case_id: row.testCaseId,
    test_case_title: row.testCaseTitle,
    automation_status: row.automationStatus,
    generated_script: row.generatedScript,
    approval_status: row.approvalStatus
  }));
}

function iconForScope(scope: ExportScope): ReactNode {
  if (scope === "Test cases") return <FileText className="size-5 text-brand-blue" aria-hidden />;
  if (scope === "Analysis items") return <FileJson className="size-5 text-brand-blue" aria-hidden />;
  if (scope === "Automation readiness") return <FileSpreadsheet className="size-5 text-brand-blue" aria-hidden />;
  return <Table2 className="size-5 text-brand-blue" aria-hidden />;
}

function descriptionForScope(scope: ExportScope) {
  if (scope === "Test cases") return "Structured test cases for QA execution, approval, and test management import.";
  if (scope === "Analysis items") return "Business rules, stories, criteria, risks, assumptions, actors, integrations, and data needs.";
  if (scope === "Automation readiness") return "Readiness classifications, confidence scores, reasons, and recommended framework.";
  return "Requirement source to analysis item to test case to generated automation mapping.";
}
