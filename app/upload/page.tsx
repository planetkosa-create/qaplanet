"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, FileSpreadsheet, FileText, FileType2, Loader2, Send, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { GuidanceRail } from "@/components/layout/GuidanceRail";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import { getStoredProjectId } from "@/lib/project-context";
import { loadSupabaseWorkspace, writeWorkspaceSnapshot } from "@/lib/workspace-sync";
import { sampleRequirements } from "@/lib/sample-data";
import { sampleRequirementSources } from "@/lib/phase2-sample-data";
import type { RequirementSource } from "@/lib/types";

const allowedTypes = [".docx", ".pdf", ".xlsx", ".txt"];

export default function UploadPage() {
  const [manualText, setManualText] = useState(sampleRequirements);
  const [sources, setSources] = useState<RequirementSource[]>(sampleRequirementSources);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const configured = hasSupabaseConfig();

  useEffect(() => {
    setManualText(readJson(appStorageKeys.requirements, sampleRequirements));
    setSources(readJson(appStorageKeys.requirementSources, sampleRequirementSources));

    async function loadSavedWorkspace() {
      const snapshot = await loadSupabaseWorkspace(getStoredProjectId());
      if (!snapshot) {
        return;
      }

      setManualText(snapshot.requirementSources.map((source) => source.extractedText).join("\n\n"));
      setSources(snapshot.requirementSources);
      writeWorkspaceSnapshot(snapshot);
    }

    void loadSavedWorkspace();
  }, []);

  const totalWords = useMemo(
    () => sources.map((source) => source.extractedText).join(" ").trim().split(/\s+/).filter(Boolean).length,
    [sources]
  );

  function persist(nextSources: RequirementSource[]) {
    setSources(nextSources);
    writeJson(appStorageKeys.requirementSources, nextSources);
    writeJson(appStorageKeys.documents, nextSources);
    writeJson(appStorageKeys.requirements, nextSources.map((source) => source.extractedText).join("\n\n"));
  }

  async function saveSourceToSupabase(source: RequirementSource): Promise<RequirementSource> {
    const supabase = createSupabaseBrowserClient();
    if (!configured || !supabase) {
      return source;
    }

    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      return source;
    }
    const ownerId = user.data.user.id;
    const projectId = getStoredProjectId();

    const result = await supabase.from("requirement_sources").insert({
      ...(projectId ? { project_id: projectId } : {}),
      owner_id: ownerId,
      file_name: source.fileName,
      source_type: source.sourceType,
      file_type: source.fileType,
      file_size: source.fileSize,
      storage_path: source.storagePath,
      extracted_text: source.extractedText,
      processing_status: source.processingStatus
    }).select("id, project_id").single();

    if (result.data) {
      return {
        ...source,
        id: result.data.id,
        projectId: result.data.project_id ?? source.projectId
      };
    }

    return source;
  }

  async function addManualSource() {
    if (!manualText.trim()) {
      setMessage("Paste requirement text before saving a manual source.");
      return;
    }

    const source: RequirementSource = {
      id: crypto.randomUUID(),
      fileName: "Manual requirements paste",
      sourceType: "Manual Paste",
      fileType: "text/plain",
      fileSize: manualText.length,
      extractedText: manualText,
      processingStatus: "Analysis Ready",
      createdAt: new Date().toISOString()
    };
    const savedSource = await saveSourceToSupabase(source);
    const nextSources = [savedSource, ...sources];
    persist(nextSources);
    setMessage("Manual requirement source saved and ready for analysis.");
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setLoading(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const nextSources = [...sources];

    try {
      for (const file of Array.from(files)) {
        const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
        if (!allowedTypes.includes(extension)) {
          setMessage(`Skipped ${file.name}. Supported files: ${allowedTypes.join(", ")}.`);
          continue;
        }

        let storagePath: string | undefined;
        if (configured && supabase) {
          const user = await supabase.auth.getUser();
          if (user.data.user) {
            const ownerId = user.data.user.id;
            const path = `${ownerId}/${crypto.randomUUID()}-${file.name}`;
            const upload = await supabase.storage.from("requirement-documents").upload(path, file);
            if (!upload.error) {
              storagePath = path;
            }
          }
        }

        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/documents/extract", {
          method: "POST",
          body: formData
        });
        const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
        const source: RequirementSource = {
          id: crypto.randomUUID(),
          fileName: file.name,
          sourceType: "Upload",
          fileType: file.type || extension,
          fileSize: file.size,
          storagePath,
          extractedText: data.text ?? "",
          processingStatus: data.text ? "Analysis Ready" : "Failed",
          createdAt: new Date().toISOString()
        };
        const savedSource = await saveSourceToSupabase(source);
        nextSources.unshift(savedSource);
      }

      persist(nextSources);
      setMessage("Requirement files processed. Review the extracted preview, then run AI analysis.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed.";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell rightRail={<GuidanceRail />}>
      <PageHeader
        title="Requirements Upload"
        description="Upload BRDs, user stories, acceptance criteria, spreadsheets, PDFs, or paste requirements manually. Extracted text is stored as requirement sources for traceable AI analysis."
        actions={
          <Link href="/ai-analysis">
            <Button icon={<Send className="size-4" aria-hidden />}>Go to AI Analysis</Button>
          </Link>
        }
      />

      <section className="grid gap-5 2xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <label className="card flex min-h-64 cursor-pointer flex-col items-center justify-center border-dashed p-8 text-center transition hover:border-brand-blue hover:bg-blue-50/40">
            <UploadCloud className="size-12 text-brand-blue" aria-hidden />
            <span className="mt-4 text-lg font-semibold text-slate-950">Upload requirement files</span>
            <span className="mt-2 text-sm text-slate-600">Supports DOCX, PDF, XLSX, and TXT.</span>
            <input type="file" className="sr-only" multiple accept={allowedTypes.join(",")} onChange={(event) => handleFiles(event.target.files)} />
            {loading ? (
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-blue">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Extracting text
              </span>
            ) : null}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Word DOCX", icon: FileText, hint: "BRDs and formatted requirements" },
              { label: "PDF", icon: FileType2, hint: "Signed planning documents" },
              { label: "Excel XLSX", icon: FileSpreadsheet, hint: "Matrices and tabular criteria" },
              { label: "User Stories TXT", icon: FileText, hint: "Plain text backlog exports" }
            ].map((format) => {
              const Icon = format.icon;
              return (
                <div key={format.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <Icon className="size-5 text-brand-blue" aria-hidden />
                  <h3 className="mt-3 text-sm font-bold text-slate-950">{format.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{format.hint}</p>
                </div>
              );
            })}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Manual Paste</h2>
              <Badge tone="blue">{manualText.trim().split(/\s+/).filter(Boolean).length} words</Badge>
            </div>
            <Textarea
              className="mt-4 min-h-56 font-mono text-xs"
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder="Paste requirements, acceptance criteria, BRDs, or test planning notes here."
            />
            <Button className="mt-4" onClick={addManualSource} icon={<FileText className="size-4" aria-hidden />}>
              Save Manual Source
            </Button>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Requirement Sources</h2>
              <p className="text-sm text-slate-600">{sources.length} sources, {totalWords} extracted words</p>
            </div>
            <Link href="/ai-analysis">
              <Button variant="secondary" icon={<Bot className="size-4" aria-hidden />}>Analyze All</Button>
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {sources.map((source) => (
              <article key={source.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{source.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {source.sourceType} • {source.fileType} • {new Date(source.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={source.processingStatus === "Analysis Ready" ? "teal" : "neutral"}>{source.processingStatus}</Badge>
                </div>
                <p className="mt-3 line-clamp-4 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  {source.extractedText || "No extracted text available."}
                </p>
              </article>
            ))}
          </div>
          {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
