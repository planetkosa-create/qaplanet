"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { Archive, CheckCircle2, FolderPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ResetProjectWorkflow } from "@/components/reset-project-workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Project } from "@/lib/types";

const emptyProject: Project = {
  name: "",
  clientName: "",
  applicationName: "",
  releaseName: "",
  description: "",
  status: "Active"
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project>(emptyProject);
  const [draft, setDraft] = useState<Project>(emptyProject);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const loadProjects = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      const storedProject = readJson<Project>(appStorageKeys.project, emptyProject);
      setProjects(storedProject.name ? [storedProject] : []);
      return;
    }

    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      return;
    }

    const result = await supabase
      .from("projects")
      .select("id, name, client_name, application_name, release_name, description, status, created_at, updated_at")
      .eq("owner_id", user.data.user.id)
      .order("updated_at", { ascending: false });

    if (result.data) {
      const nextProjects = result.data.map(rowToProject);
      setProjects(nextProjects);
      const storedProject = readJson<Project>(appStorageKeys.project, emptyProject);
      if (!storedProject.id && nextProjects[0]) {
        setActiveProject(nextProjects[0]);
        setDraft(nextProjects[0]);
        writeJson(appStorageKeys.project, nextProjects[0]);
      }
    }
  }, []);

  useEffect(() => {
    const storedProject = readJson<Project>(appStorageKeys.project, emptyProject);
    setActiveProject(storedProject);
    setDraft(storedProject.name ? storedProject : emptyProject);
    void loadProjects();
  }, [loadProjects]);

  function setActive(project: Project) {
    setActiveProject(project);
    setDraft(project);
    writeJson(appStorageKeys.project, project);
    setMessage(`${project.name} is now the active project.`);
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setMessage("Enter a project name before saving.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      let savedProject: Project = {
        ...draft,
        name,
        description: draft.description?.trim() ?? "",
        status: draft.status ?? "Active"
      };

      if (supabase) {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
          throw new Error("Sign in before saving project workspace details.");
        }

        const payload = {
          owner_id: user.data.user.id,
          name: savedProject.name,
          client_name: savedProject.clientName,
          application_name: savedProject.applicationName,
          release_name: savedProject.releaseName,
          description: savedProject.description,
          status: normalizeDbStatus(savedProject.status),
          updated_at: new Date().toISOString()
        };

        const result = savedProject.id
          ? await supabase
              .from("projects")
              .update(payload)
              .eq("id", savedProject.id)
              .eq("owner_id", user.data.user.id)
              .select("id, name, client_name, application_name, release_name, description, status, created_at, updated_at")
              .single()
          : await supabase
              .from("projects")
              .insert(payload)
              .select("id, name, client_name, application_name, release_name, description, status, created_at, updated_at")
              .single();

        if (result.error) {
          throw new Error(result.error.message);
        }
        savedProject = rowToProject(result.data);
      }

      setActiveProject(savedProject);
      setDraft(savedProject);
      writeJson(appStorageKeys.project, savedProject);
      setProjects((current) => [savedProject, ...current.filter((project) => project.id !== savedProject.id)]);
      setMessage("Project workspace saved and selected.");
      void loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project save failed.");
    } finally {
      setLoading(false);
    }
  }

  async function archiveProject(project: Project) {
    await updateProjectStatus(project, "Archived");
  }

  async function deleteProject() {
    if (!activeProject.id || deleteConfirmation !== "DELETE") {
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setProjects([]);
        setActiveProject(emptyProject);
        setDraft(emptyProject);
        writeJson(appStorageKeys.project, emptyProject);
        setMessage("Local project deleted.");
        return;
      }

      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error("Sign in before deleting a project.");
      }

      const result = await supabase.from("projects").delete().eq("id", activeProject.id).eq("owner_id", user.data.user.id);
      if (result.error) {
        throw new Error(result.error.message);
      }

      setDeleteConfirmation("");
      setActiveProject(emptyProject);
      setDraft(emptyProject);
      writeJson(appStorageKeys.project, emptyProject);
      await loadProjects();
      setMessage("Project deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project delete failed.");
    } finally {
      setLoading(false);
    }
  }

  async function updateProjectStatus(project: Project, status: Project["status"]) {
    setLoading(true);
    setMessage("");
    try {
      const nextProject = { ...project, status };
      const supabase = createSupabaseBrowserClient();
      if (supabase && project.id) {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
          throw new Error("Sign in before updating project status.");
        }
        const result = await supabase
          .from("projects")
          .update({ status: normalizeDbStatus(status), updated_at: new Date().toISOString() })
          .eq("id", project.id)
          .eq("owner_id", user.data.user.id);

        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      setProjects((current) => current.map((item) => (item.id === project.id ? nextProject : item)));
      if (activeProject.id === project.id) {
        setActive(nextProject);
      }
      setMessage(`${project.name} marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project update failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Projects"
        description="Create, switch, edit, archive, reset, or delete QA workspaces while keeping every deliverable scoped to the active project."
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={saveProject} className="card p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-brand-blue">
              <FolderPlus className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950">{draft.id ? "Edit Project" : "Create Project"}</h2>
              <p className="text-sm text-slate-500">Define the client, application, and release context for the demo.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Project name</span>
              <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
            </label>
            <Field label="Client name" value={draft.clientName ?? ""} onChange={(value) => setDraft({ ...draft, clientName: value })} />
            <Field label="Application name" value={draft.applicationName ?? ""} onChange={(value) => setDraft({ ...draft, applicationName: value })} />
            <Field label="Release name" value={draft.releaseName ?? ""} onChange={(value) => setDraft({ ...draft, releaseName: value })} />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Status</span>
              <select
                className="focus-ring min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={displayStatus(draft.status)}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as Project["status"] })}
              >
                <option>Active</option>
                <option>Archived</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Description</span>
              <Textarea rows={4} value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}>
              {loading ? "Saving" : "Save Project"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDraft(emptyProject)}>
              New Blank Project
            </Button>
            <ResetProjectWorkflow projectId={activeProject.id} compact />
          </div>
          {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        </form>

        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="text-lg font-bold text-slate-950">Active Project</h2>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-base font-bold text-slate-950">{activeProject.name || "No active project selected"}</p>
                  <p className="mt-1 text-sm text-slate-600">{activeProject.description || "Create or select a project to begin."}</p>
                </div>
                <Badge tone={displayStatus(activeProject.status) === "Archived" ? "neutral" : "teal"}>{displayStatus(activeProject.status)}</Badge>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">Project List</div>
            <div className="divide-y divide-slate-100">
              {projects.length ? (
                projects.map((project) => (
                  <article key={project.id ?? project.name} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-950">{project.name}</p>
                          {activeProject.id === project.id || (!activeProject.id && activeProject.name === project.name) ? <Badge tone="blue">Active</Badge> : null}
                          <Badge>{displayStatus(project.status)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{project.clientName || "No client"} • {project.applicationName || "No application"} • {project.releaseName || "No release"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" onClick={() => setActive(project)}>Switch</Button>
                        <Button type="button" variant="secondary" onClick={() => setDraft(project)} icon={<Pencil className="size-4" aria-hidden />}>Edit</Button>
                        <Button type="button" variant="secondary" onClick={() => archiveProject(project)} icon={<Archive className="size-4" aria-hidden />}>Archive</Button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="p-5 text-sm text-slate-600">No projects yet. Create one to start a clean demo workspace.</p>
              )}
            </div>
          </div>

          <div className="card border-rose-100 p-5">
            <h2 className="text-lg font-bold text-slate-950">Delete Active Project</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">This permanently deletes the selected project and its workflow data. Type DELETE to enable the action.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="DELETE" />
              <Button type="button" variant="danger" disabled={!activeProject.id || deleteConfirmation !== "DELETE" || loading} onClick={deleteProject} icon={<Trash2 className="size-4" aria-hidden />}>
                Delete Project
              </Button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    clientName: String(row.client_name ?? ""),
    applicationName: String(row.application_name ?? ""),
    releaseName: String(row.release_name ?? ""),
    description: String(row.description ?? ""),
    status: String(row.status ?? "active") === "archived" ? "Archived" : "Active",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? "")
  };
}

function normalizeDbStatus(status: Project["status"]) {
  return displayStatus(status).toLowerCase();
}

function displayStatus(status: Project["status"]) {
  return String(status ?? "Active").toLowerCase() === "archived" ? "Archived" : "Active";
}
