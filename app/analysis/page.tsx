"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getStoredProjectId, isUuid } from "@/lib/project-context";
import { sampleAnalysisItems, sampleRequirementSources } from "@/lib/phase2-sample-data";
import type { AnalysisItem, AnalysisItemType, RequirementSource } from "@/lib/types";

const itemOrder: AnalysisItemType[] = [
  "Business Rule",
  "User Story",
  "Acceptance Criteria",
  "Risk",
  "Gap",
  "Assumption",
  "Actor / Role",
  "System / Integration",
  "Data Requirement"
];

export default function AnalysisPage() {
  const [sources, setSources] = useState<RequirementSource[]>(sampleRequirementSources);
  const [items, setItems] = useState<AnalysisItem[]>(sampleAnalysisItems);
  const [summary, setSummary] = useState("Requirements are ready for structured QA analysis.");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSources(readJson(appStorageKeys.requirementSources, sampleRequirementSources));
    setItems(readJson(appStorageKeys.analysisItems, sampleAnalysisItems));
  }, []);

  const grouped = useMemo(() => {
    return itemOrder.map((type) => ({
      type,
      items: items.filter((item) => item.itemType === type)
    }));
  }, [items]);

  async function saveItemsToSupabase(nextItems: AnalysisItem[]) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      return;
    }
    const ownerId = user.data.user.id;
    const projectId = getStoredProjectId();

    await supabase.from("analysis_items").insert(
      nextItems.map((item) => ({
        ...(projectId ? { project_id: projectId } : {}),
        owner_id: ownerId,
        ...(isUuid(item.requirementSourceId) ? { requirement_source_id: item.requirementSourceId } : {}),
        item_type: item.itemType,
        title: item.title,
        description: item.description,
        reference_code: item.referenceCode,
        confidence_score: item.confidenceScore
      }))
    );
  }

  async function analyze() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources })
      });
      const data = (await response.json().catch(() => ({}))) as {
        summary?: string;
        analysisItems?: AnalysisItem[];
        error?: string;
      };

      if (!response.ok || !data.analysisItems) {
        setMessage(data.error ?? "Analysis failed. Check OpenAI quota, billing, and Vercel runtime logs.");
        return;
      }

      setItems(data.analysisItems);
      setSummary(data.summary ?? "AI analysis completed.");
      writeJson(appStorageKeys.analysisItems, data.analysisItems);
      await saveItemsToSupabase(data.analysisItems);
      setMessage("AI analysis completed and analysis items are ready for test generation.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Analysis failed.";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="AI Analysis"
        description="Extract traceable business rules, user stories, acceptance criteria, risks, gaps, actors, systems, and data requirements."
        actions={
          <>
            <Button onClick={analyze} disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bot className="size-4" aria-hidden />}>
              Run AI Analysis
            </Button>
            <Link href="/test-case-generator">
              <Button variant="secondary" icon={<Send className="size-4" aria-hidden />}>Generate Test Cases</Button>
            </Link>
          </>
        }
      />

      <section className="mb-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Analysis Summary</h2>
            <Badge tone="teal">{items.length} items</Badge>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-600">{summary}</p>
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            {sources.length} requirement sources available for analysis.
          </div>
          {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Analysis Item Register
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold text-brand-blue">{item.referenceCode}</td>
                    <td className="px-4 py-3">{item.itemType}</td>
                    <td className="px-4 py-3 text-slate-700">{item.title}</td>
                    <td className="px-4 py-3">{Math.round(item.confidenceScore * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {items.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map((group) => (
            <article key={group.type} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-950">{group.type}</h3>
                <Badge>{group.items.length}</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {group.items.length ? (
                  group.items.map((item) => (
                    <div key={item.id} className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-brand-blue">{item.referenceCode}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No items extracted yet.</p>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="No analysis items yet" description="Upload requirements, then run AI analysis to extract traceable QA inputs." />
      )}
    </AppShell>
  );
}
