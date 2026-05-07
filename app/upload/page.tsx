"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, FileText, Loader2, Send, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
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

  async function saveSourceToSupabase(source: RequirementSource) {
    const supabase = createSupabaseBrowserClient();
    if (!configured || !supabase) {
      return;
    }

    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      return;
    }

    await supabase.from("requirement_sources").insert({
      id: source.id,
      owner_id: user.data.user.id,
      file_name: source.fileName,
      source_type: source.sourceType,
      file_type: source.fileType,
      file_size: source.fileSize,
      storage_path: source.storagePath,
      extracted_text: source.extractedText,
      processing_status: source.processingStatus
    });
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
    const nextSources = [source, ...sources];
    persist(nextSources);
    await saveSourceToSupabase(source);
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
            const path = `${user.data.user.id}/${crypto.randomUUID()}-${file.name}`;
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
        nextSources.unshift(source);
        await saveSourceToSupabase(source);
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
    <AppShell>
      <PageHeader
        title="Requirements Upload"
        description="Upload BRDs, user stories, acceptance criteria, spreadsheets, PDFs, or paste requirements manually. Extracted text is stored as requirement sources for traceable AI analysis."
        actions={
          <Link href="/ai-analysis">
            <Button icon={<Send className="size-4" aria-hidden />}>Go to AI Analysis</Button>
          </Link>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <label className="card flex min-h-64 cursor-pointer flex-col items-center justify-center border-dashed p-8 text-center hover:border-brand-blue hover:bg-blue-50/40">
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
              <article key={source.id} className="rounded-lg border border-slate-200 p-4">
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
