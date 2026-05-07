"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { sampleAnalysis, sampleRequirements } from "@/lib/sample-data";
import type { RequirementAnalysis } from "@/lib/types";

type AnalysisListKey = Exclude<keyof RequirementAnalysis, "summary">;

const groups: Array<{ key: AnalysisListKey; label: string }> = [
  { key: "businessRules", label: "Business Rules" },
  { key: "userStories", label: "User Stories" },
  { key: "acceptanceCriteria", label: "Acceptance Criteria" },
  { key: "risks", label: "Risks" },
  { key: "gaps", label: "Gaps" },
  { key: "assumptions", label: "Assumptions" }
];

export default function AnalysisPage() {
  const [requirements, setRequirements] = useState(sampleRequirements);
  const [analysis, setAnalysis] = useState<RequirementAnalysis>(sampleAnalysis);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRequirements(readJson(appStorageKeys.requirements, sampleRequirements));
    setAnalysis(readJson(appStorageKeys.analysis, sampleAnalysis));
  }, []);

  async function analyze() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirements })
    });
    const data = (await response.json()) as { analysis?: RequirementAnalysis; error?: string };
    setLoading(false);

    if (!response.ok || !data.analysis) {
      setMessage(data.error ?? "Analysis failed. Check your OpenAI API key.");
      return;
    }

    setAnalysis(data.analysis);
    writeJson(appStorageKeys.analysis, data.analysis);
    setMessage("AI analysis completed.");
  }

  return (
    <AppShell>
      <PageHeader
        title="AI Analysis"
        description="Extract business rules, user stories, acceptance criteria, risks, gaps, and assumptions before generating QA-ready test cases."
        actions={
          <>
            <Button onClick={analyze} disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bot className="size-4" aria-hidden />}>
              Run AI Analysis
            </Button>
            <Link href="/test-cases">
              <Button variant="secondary" icon={<Send className="size-4" aria-hidden />}>Generate Test Cases</Button>
            </Link>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Analysis Summary</h2>
            <Badge tone="teal">Senior QA lens</Badge>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-600">{analysis.summary}</p>
          {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => {
            const values = analysis[group.key];
            return (
              <article key={group.key} className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-950">{group.label}</h3>
                  <Badge>{Array.isArray(values) ? values.length : 0}</Badge>
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  {Array.isArray(values)
                    ? values.map((value) => (
                        <li key={value} className="rounded-md bg-slate-50 p-3">{value}</li>
                      ))
                    : null}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
