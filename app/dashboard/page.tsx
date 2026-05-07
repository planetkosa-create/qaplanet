"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, FileText, FolderPlus, Gauge, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge, ReadinessBadge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/field";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { sampleAnalysis, sampleDocuments, sampleRequirements, sampleTestCases } from "@/lib/sample-data";
import type { Project, RequirementAnalysis, TestCase, UploadedDocument } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const defaultProject: Project = {
  id: "sample-project",
  name: "Customer portal QA initiative",
  description: "Sample project for requirements analysis and automation generation."
};

export default function DashboardPage() {
  const [project, setProject] = useState<Project>(defaultProject);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [analysis, setAnalysis] = useState<RequirementAnalysis>(sampleAnalysis);
  const [testCases, setTestCases] = useState<TestCase[]>(sampleTestCases);
  const [documents, setDocuments] = useState<UploadedDocument[]>(sampleDocuments);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProject(readJson(appStorageKeys.project, defaultProject));
    setAnalysis(readJson(appStorageKeys.analysis, sampleAnalysis));
    setTestCases(readJson(appStorageKeys.testCases, sampleTestCases));
    setDocuments(readJson(appStorageKeys.documents, sampleDocuments));
    if (!window.localStorage.getItem(appStorageKeys.requirements)) {
      writeJson(appStorageKeys.requirements, sampleRequirements);
    }
  }, []);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
  }, [project]);

  const stats = useMemo(() => {
    const automatable = testCases.filter((testCase) => testCase.readiness === "Automatable").length;
    const approved = testCases.filter((testCase) => testCase.status === "Approved").length;
    return { automatable, approved };
  }, [testCases]);

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const nextProject = {
      id: project.id || crypto.randomUUID(),
      name,
      description
    };
    let nextMessage = "Project saved.";

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      const user = await supabase.auth.getUser();
      if (user.data.user) {
        const payload = {
          id: nextProject.id,
          owner_id: user.data.user.id,
          name: nextProject.name,
          description: nextProject.description
        };
        const result = await supabase.from("projects").upsert(payload).select("id, name, description").single();
        if (result.error) {
          nextMessage = result.error.message;
        } else if (result.data) {
          nextProject.id = result.data.id;
        }
      }
    }

    setProject(nextProject);
    writeJson(appStorageKeys.project, nextProject);
    setMessage(nextMessage);
  }

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Create projects, track uploaded requirement sources, review analysis coverage, and move high-value test cases toward automation."
        actions={
          <Link href="/requirements-upload">
            <Button icon={<UploadCloud className="size-4" aria-hidden />}>Upload Requirements</Button>
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Documents", value: documents.length, icon: FileText },
          { label: "Analysis items", value: analysis.businessRules.length + analysis.acceptanceCriteria.length, icon: Bot },
          { label: "Generated test cases", value: testCases.length, icon: CheckCircle2 },
          { label: "Automatable", value: stats.automatable, icon: Gauge }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                <Icon className="size-5 text-brand-blue" aria-hidden />
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-950">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={saveProject} className="card p-5">
          <div className="flex items-center gap-2">
            <FolderPlus className="size-5 text-brand-teal" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-950">Project</h2>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Project name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Description</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
            </label>
            <Button>Save Project</Button>
            {message ? <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
          </div>
        </form>

        <div className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Current QA Flow</h2>
              <p className="mt-1 text-sm text-slate-600">{project.name}</p>
            </div>
            <Badge tone="teal">{stats.approved} approved</Badge>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {testCases.slice(0, 3).map((testCase) => (
              <article key={testCase.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-brand-blue">{testCase.testCaseId}</span>
                  <ReadinessBadge value={testCase.readiness} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{testCase.name}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{testCase.description}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/ai-analysis">
              <Button variant="secondary" icon={<ArrowRight className="size-4" aria-hidden />}>Review Analysis</Button>
            </Link>
            <Link href="/code-generation">
              <Button variant="secondary" icon={<ArrowRight className="size-4" aria-hidden />}>Generate Code</Button>
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
