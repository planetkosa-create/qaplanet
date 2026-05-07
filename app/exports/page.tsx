"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { appStorageKeys, readJson } from "@/lib/storage";
import { sampleTestCases } from "@/lib/sample-data";
import type { TestCase } from "@/lib/types";
import { downloadExcel, downloadTextFile, testCasesToCsv, testCasesToMarkdown } from "@/lib/exports";

export default function ExportsPage() {
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTestCases(readJson(appStorageKeys.testCases, sampleTestCases));
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Export Center"
        description="Export generated test cases for delivery, review, test management import, or project documentation."
      />

      <section className="grid gap-5 lg:grid-cols-3">
        <ExportCard
          icon={<FileText className="size-6 text-brand-blue" aria-hidden />}
          title="Markdown"
          description="Readable test case pack for documentation and team review."
          action={() => {
            downloadTextFile("qaplanet-test-cases.md", testCasesToMarkdown(testCases), "text/markdown");
            setMessage("Markdown export created.");
          }}
        />
        <ExportCard
          icon={<Download className="size-6 text-brand-blue" aria-hidden />}
          title="CSV"
          description="Flat import-friendly file for QA systems, spreadsheets, and reporting."
          action={() => {
            downloadTextFile("qaplanet-test-cases.csv", testCasesToCsv(testCases), "text/csv");
            setMessage("CSV export created.");
          }}
        />
        <ExportCard
          icon={<FileSpreadsheet className="size-6 text-brand-blue" aria-hidden />}
          title="Excel"
          description="Structured workbook for analysts and stakeholders."
          action={async () => {
            await downloadExcel(testCases);
            setMessage("Excel export created.");
          }}
        />
      </section>

      <div className="mt-5 card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Export Scope</h2>
            <p className="mt-1 text-sm text-slate-600">All current generated test cases are included.</p>
          </div>
          <Badge tone="teal">{testCases.length} test cases</Badge>
        </div>
        {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
      </div>
    </AppShell>
  );
}

function ExportCard({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: () => void | Promise<void>;
}) {
  return (
    <article className="card p-5">
      {icon}
      <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Button className="mt-5" onClick={action} icon={<Download className="size-4" aria-hidden />}>
        Export {title}
      </Button>
    </article>
  );
}
