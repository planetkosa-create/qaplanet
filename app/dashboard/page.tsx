"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, FileText, FolderPlus, Gauge, Loader2, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge, ReadinessBadge, StatusBadge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/field";
import { ResetProjectWorkflow } from "@/components/reset-project-workflow";
import { GuidanceRail } from "@/components/layout/GuidanceRail";
import { StatCard } from "@/components/ui/StatCard";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { buildCoverageSummary } from "@/lib/coverage";
import type { AnalysisItem, Project, RequirementAnalysis, RequirementSource, TestCase, UploadedDocument } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { isUuid, sanitizeProject } from "@/lib/project-context";
import { loadSupabaseWorkspace, syncLocalWorkflowToSupabase, writeWorkspaceSnapshot } from "@/lib/workspace-sync";

const defaultProject: Project = {
  name: "",
  description: ""
};

const emptyAnalysis: RequirementAnalysis = {
  summary: "",
  businessRules: [],
  userStories: [],
  acceptanceCriteria: [],
  risks: [],
  gaps: [],
  assumptions: [],
  actors: [],
  systems: [],
  dataRequirements: []
};

export default function DashboardPage() {
  const [project, setProject] = useState<Project>(defaultProject);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [analysis, setAnalysis] = useState<RequirementAnalysis>(emptyAnalysis);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [requirementSources, setRequirementSources] = useState<RequirementSource[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storedProject = sanitizeProject(readJson(appStorageKeys.project, defaultProject));
    setProject(storedProject);
    writeJson(appStorageKeys.project, storedProject);
    setAnalysis(readJson(appStorageKeys.analysis, emptyAnalysis));
    setAnalysisItems(readJson(appStorageKeys.analysisItems, []));
    setTestCases(readJson(appStorageKeys.testCases, []));
    setDocuments(readJson(appStorageKeys.documents, []));
    setRequirementSources(readJson(appStorageKeys.requirementSources, []));

    async function loadSupabaseProjectWorkspace() {
      const snapshot = await loadSupabaseWorkspace(isUuid(storedProject.id) ? storedProject.id : undefined);
      if (!snapshot) {
        return;
      }

      setProject(snapshot.project);
      setRequirementSources(snapshot.requirementSources);
      setDocuments(snapshot.documents);
      setAnalysisItems(snapshot.analysisItems);
      setTestCases(snapshot.testCases);
      writeWorkspaceSnapshot(snapshot);
    }

    void loadSupabaseProjectWorkspace();
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
  const coverage = useMemo(
    () => buildCoverageSummary({ sources: requirementSources, analysisItems, testCases }),
    [analysisItems, requirementSources, testCases]
  );

  function resetDashboardState() {
    setAnalysis({
      summary: "",
      businessRules: [],
      userStories: [],
      acceptanceCriteria: [],
      risks: [],
      gaps: [],
      assumptions: [],
      actors: [],
      systems: [],
      dataRequirements: []
    });
    setAnalysisItems([]);
    setTestCases([]);
    setDocuments([]);
    setMessage("Project workflow has been reset successfully.");
  }

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
          const savedProjectId = String(result.data.id);
          nextProject.id = savedProjectId;
          nextProject.name = result.data.name;
          nextProject.description = result.data.description;
          await syncLocalWorkflowToSupabase(savedProjectId);
          const snapshot = await loadSupabaseWorkspace(savedProjectId);
          if (snapshot) {
            setRequirementSources(snapshot.requirementSources);
            setDocuments(snapshot.documents);
            setAnalysisItems(snapshot.analysisItems);
            setTestCases(snapshot.testCases);
            writeWorkspaceSnapshot(snapshot);
          }
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
    <AppShell rightRail={<GuidanceRail />}>
      <PageHeader
        title="Dashboard"
        description="Create projects, track uploaded requirement sources, review analysis coverage, and move high-value test cases toward automation."
        actions={
          <Link href="/requirements-upload">
            <Button icon={<UploadCloud className="size-4" aria-hidden />}>Upload Requirements</Button>
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {[
          { label: "Documents", value: documents.length, icon: FileText },
          { label: "Analysis items", value: analysisItems.length || analysis.businessRules.length + analysis.acceptanceCriteria.length, icon: Bot },
          { label: "Generated test cases", value: testCases.length, icon: CheckCircle2 },
          { label: "Automatable", value: stats.automatable, icon: Gauge }
        ].map((item) => {
          const Icon = item.icon;
          return <StatCard key={item.label} label={item.label} value={item.value} icon={<Icon className="size-5" aria-hidden />} />;
        })}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Requirements Covered" value={coverage.requirementsCovered} hint={`${coverage.totalRequirements} total requirements`} />
        <StatCard label="Requirements Without Test Cases" value={coverage.requirementsWithoutTestCases} />
        <StatCard label="Risks" value={coverage.risks} />
        <StatCard label="Gaps" value={coverage.gaps} />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={saveProject} className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-10 place-items-center rounded-lg bg-teal-50 text-brand-teal">
                <FolderPlus className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Project</h2>
                <p className="text-sm text-slate-500">Keep the active QA workspace aligned to your current initiative.</p>
              </div>
            </div>
            {project.id ? <Badge tone="blue">Project ID saved</Badge> : <Badge>Local draft</Badge>}
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
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving} icon={saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
                {saving ? "Saving Project" : "Save Project"}
              </Button>
              <ResetProjectWorkflow projectId={project.id} onReset={resetDashboardState} compact />
            </div>
            {message ? <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
          </div>
        </form>

        <div className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Current QA Flow</h2>
              <p className="mt-1 text-sm text-slate-600">{project.name}</p>
            </div>
            <Badge tone="teal">{stats.approved} approved</Badge>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {testCases.slice(0, 3).map((testCase) => (
              <article key={testCase.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="whitespace-nowrap text-xs font-bold text-brand-blue">{testCase.testCaseId}</span>
                  <ReadinessBadge value={testCase.readiness} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{testCase.name}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{testCase.description}</p>
                <div className="mt-3">
                  <StatusBadge value={testCase.approvalStatus ?? testCase.status} />
                </div>
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

      <section className="mt-6 card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-700">Coverage Snapshot</h2>
            <p className="mt-1 text-xs text-slate-500">Requirement coverage based on current analysis items and test cases.</p>
          </div>
          <Link href="/coverage">
            <Button variant="secondary" className="min-h-9 px-3 py-1.5">Open Coverage</Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Requirement</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Test Cases</th>
                <th className="px-4 py-3">Approved</th>
                <th className="px-4 py-3">Automation</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coverage.rows.slice(0, 5).map((row) => (
                <tr key={row.requirementReference} className="table-row">
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-brand-blue">{row.requirementReference}</td>
                  <td className="px-4 py-3 text-slate-700">{row.requirementTitle}</td>
                  <td className="px-4 py-3">{row.testCaseCount}</td>
                  <td className="px-4 py-3">{row.approvedCount}</td>
                  <td className="px-4 py-3">{row.automationCount}</td>
                  <td className="px-4 py-3"><Badge tone={row.coverageStatus === "Covered" ? "teal" : row.coverageStatus === "Partial" ? "blue" : "neutral"}>{row.coverageStatus}</Badge></td>
                </tr>
              ))}
              {!coverage.rows.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>Upload requirements and generate test cases to see coverage.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
