"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileUp, Loader2, Send, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import { sampleDocuments, sampleRequirements } from "@/lib/sample-data";
import type { UploadedDocument } from "@/lib/types";

const allowedTypes = [".docx", ".pdf", ".xlsx", ".txt"];

export default function UploadPage() {
  const [requirements, setRequirements] = useState(sampleRequirements);
  const [documents, setDocuments] = useState<UploadedDocument[]>(sampleDocuments);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const configured = hasSupabaseConfig();

  useEffect(() => {
    setRequirements(readJson(appStorageKeys.requirements, sampleRequirements));
    setDocuments(readJson(appStorageKeys.documents, sampleDocuments));
  }, []);

  const wordCount = useMemo(() => requirements.trim().split(/\s+/).filter(Boolean).length, [requirements]);

  function saveRequirements() {
    writeJson(appStorageKeys.requirements, requirements);
    setMessage("Requirements saved for AI analysis.");
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setLoading(true);
    setMessage("");
    const nextDocuments = [...documents];
    const extractedText: string[] = [];
    const supabase = createSupabaseBrowserClient();

    for (const file of Array.from(files)) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!allowedTypes.includes(extension)) {
        setMessage(`Skipped ${file.name}. Supported files: ${allowedTypes.join(", ")}.`);
        continue;
      }

      let storagePath: string | undefined;
      if (configured && supabase) {
        const path = `requirements/${crypto.randomUUID()}-${file.name}`;
        const upload = await supabase.storage.from("requirement-documents").upload(path, file);
        if (!upload.error) {
          storagePath = path;
          await supabase.from("uploaded_documents").insert({
            file_name: file.name,
            file_type: file.type || extension,
            file_size: file.size,
            storage_path: path
          });
        }
      }

      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/documents/extract", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (data.text) {
        extractedText.push(data.text);
      }

      nextDocuments.unshift({
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: file.type || extension,
        fileSize: file.size,
        storagePath,
        extractedText: data.text,
        createdAt: new Date().toISOString()
      });
    }

    const nextRequirements = [requirements, ...extractedText].filter(Boolean).join("\n\n");
    setDocuments(nextDocuments);
    setRequirements(nextRequirements);
    writeJson(appStorageKeys.documents, nextDocuments);
    writeJson(appStorageKeys.requirements, nextRequirements);
    setLoading(false);
    setMessage("Upload complete. Extracted text was added to the requirements workspace.");
  }

  return (
    <AppShell>
      <PageHeader
        title="Requirements Upload"
        description="Upload business requirements, BRDs, user stories, acceptance criteria, or test planning documents. You can also paste raw requirements text directly."
        actions={
          <Link href="/analysis">
            <Button icon={<Send className="size-4" aria-hidden />}>Go to AI Analysis</Button>
          </Link>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <label className="card flex min-h-72 cursor-pointer flex-col items-center justify-center border-dashed p-8 text-center hover:border-brand-blue hover:bg-blue-50/40">
            <UploadCloud className="size-12 text-brand-blue" aria-hidden />
            <span className="mt-4 text-lg font-semibold text-slate-950">Drop or select requirement files</span>
            <span className="mt-2 text-sm text-slate-600">Supports DOCX, PDF, XLSX, and TXT.</span>
            <input
              type="file"
              className="sr-only"
              multiple
              accept={allowedTypes.join(",")}
              onChange={(event) => handleFiles(event.target.files)}
            />
            {loading ? (
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-blue">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Processing files
              </span>
            ) : null}
          </label>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Uploaded Documents</h2>
              <Badge tone="blue">{documents.length} files</Badge>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center gap-3 py-3">
                  <FileUp className="size-5 text-brand-teal" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{document.fileName}</p>
                    <p className="text-xs text-slate-500">{Math.max(1, Math.round(document.fileSize / 1024))} KB</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Manual Requirements</h2>
              <p className="text-sm text-slate-600">{wordCount} words available for analysis</p>
            </div>
            <Button variant="secondary" onClick={saveRequirements}>Save Text</Button>
          </div>
          <Textarea
            className="mt-4 min-h-[520px] font-mono text-xs"
            value={requirements}
            onChange={(event) => setRequirements(event.target.value)}
            placeholder="Paste requirements, acceptance criteria, BRDs, or test planning notes here."
          />
          {message ? <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
