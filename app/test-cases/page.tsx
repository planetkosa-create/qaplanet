"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { TestCaseTable } from "@/components/test-case-table";
import { EmptyState } from "@/components/ui/empty-state";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { sampleAnalysis, sampleRequirements, sampleTestCases } from "@/lib/sample-data";
import type { RequirementAnalysis, TestCase } from "@/lib/types";

export default function TestCasesPage() {
  const [requirements, setRequirements] = useState(sampleRequirements);
  const [analysis, setAnalysis] = useState<RequirementAnalysis>(sampleAnalysis);
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRequirements(readJson(appStorageKeys.requirements, sampleRequirements));
    setAnalysis(readJson(appStorageKeys.analysis, sampleAnalysis));
    setTestCases(readJson(appStorageKeys.testCases, sampleTestCases));
  }, []);

  function persist(next: TestCase[]) {
    setTestCases(next);
    writeJson(appStorageKeys.testCases, next);
  }

  async function generate() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/ai/generate-test-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirements, analysis })
    });
    const data = (await response.json()) as { testCases?: TestCase[]; error?: string };
    setLoading(false);

    if (!response.ok || !data.testCases) {
      setMessage(data.error ?? "Test case generation failed. Check your OpenAI API key.");
      return;
    }

    persist(data.testCases);
    setMessage("Generated practical QA test cases from the latest analysis.");
  }

  return (
    <AppShell>
      <PageHeader
        title="Generated Test Cases"
        description="Edit, approve, reject, or regenerate structured test cases before evaluating automation readiness."
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

      {message ? <p className="mb-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

      {testCases.length ? (
        <TestCaseTable testCases={testCases} onChange={persist} />
      ) : (
        <EmptyState
          title="No test cases yet"
          description="Run generation after uploading and analyzing requirements."
          action={<Button onClick={generate}>Generate Test Cases</Button>}
        />
      )}
    </AppShell>
  );
}
