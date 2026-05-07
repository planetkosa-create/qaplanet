"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, FileText, FolderPlus, Gauge, Loader2, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge, ReadinessBadge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/field";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { sampleAnalysis, sampleDocuments, sampleRequirements, sampleTestCases } from "@/lib/sample-data";
import type { Project, RequirementAnalysis, TestCase, UploadedDocument } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { isUuid, sanitizeProject } from "@/lib/project-context";

const defaultProject: Project = {
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storedProject = sanitizeProject(readJson(appStorageKeys.project, defaultProject));
    setProject(storedProject);
    writeJson(appStorageKeys.project, storedProject);
    setAnalysis(readJson(appStorageKeys.analysis, sampleAnalysis));
    setTestCases(readJson(appStorageKeys.testCases, sampleTestCases));
    setDocuments(readJson(appStorageKeys.documents, sampleDocuments));
    if (!window.localStorage.getItem(appStorageKeys.requirements)) {
      writeJson(appStorageKeys.requirements, sampleRequirements);
    }

    async function loadSupabaseProject() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        return;
      }

      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return;
      }

      const result = await supabase
        .from("projects")
        .select("id, name, description, created_at")
        .eq("owner_id", user.data.user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.data) {
        const savedProject: Project = {
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          created_at: result.data.created_at
        };
        setProject(savedProject);
        writeJson(appStorageKeys.project, savedProject);
      }
    }

    void loadSupabaseProject();
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
    setSaving(true);

    const projectName = name.trim();
    const projectDescription = description.trim();
    if (!projectName) {
      setMessage("Enter a project name before saving.");
      setSaving(false);
      return;
    }

    const nextProject = {
      id: isUuid(project.id) ? project.id : undefined,
      name: projectName,
      description: projectDescription
    };
    let nextMessage = "Project saved.";

    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
          setMessage("Sign in before saving a project to Supabase.");
          setSaving(false);
          return;
        }

        const ownerId = user.data.user.id;
        const result = nextProject.id
          ? await supabase
              .from("projects")
              .update({
                name: nextProject.name,
                description: nextProject.description,
                updated_at: new Date().toISOString()
              })
              .eq("id", nextProject.id)
              .eq("owner_id", ownerId)
              .select("id, name, description")
              .single()
          : await supabase
              .from("projects")
              .insert({
                owner_id: ownerId,
                name: nextProject.name,
                description: nextProject.description
              })
              .select("id, name, description")
              .single();

        if (result.error) {
          setMessage(result.error.message);
          setSaving(false);
          return;
        }

        if (result.data) {
          nextProject.id = result.data.id;
          nextProject.name = result.data.name;
          nextProject.description = result.data.description;
          nextMessage = "Project saved with Supabase project ID.";
        }
      } else {
        nextMessage = "Project saved locally. Configure Supabase to persist it.";
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project save failed.");
      setSaving(false);
      return;
    }

    setProject(nextProject);
    writeJson(appStorageKeys.project, nextProject);
    setMessage(nextMessage);
    setSaving(false);
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
            <Button disabled={saving} icon={saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              {saving ? "Saving Project" : "Save Project"}
            </Button>
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
