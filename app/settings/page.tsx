"use client";

import { useState } from "react";
import { CheckCircle2, Database, KeyRound, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasSupabaseConfig } from "@/lib/supabase";
import { ResetProjectWorkflow } from "@/components/reset-project-workflow";

const envVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENAI_API_KEY"
];

export default function SettingsPage() {
  const [cleared, setCleared] = useState(false);
  const supabaseConfigured = hasSupabaseConfig();

  function clearLocalWorkspace() {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("qaplanet."))
      .forEach((key) => localStorage.removeItem(key));
    setCleared(true);
  }

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Review runtime configuration, storage assumptions, and local MVP workspace controls."
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-brand-blue" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-950">Environment Variables</h2>
          </div>
          <div className="mt-4 space-y-3">
            {envVars.map((variable) => (
              <div key={variable} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <code className="text-xs font-semibold text-slate-700">{variable}</code>
                <Badge tone={variable.startsWith("NEXT_PUBLIC") && supabaseConfigured ? "teal" : "neutral"}>
                  {variable.startsWith("NEXT_PUBLIC") && supabaseConfigured ? "Configured" : "Required"}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Database className="size-5 text-brand-teal" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-950">Supabase Resources</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li className="rounded-md bg-slate-50 p-3">Postgres tables: profiles, projects, uploaded_documents, requirement_analysis, test_cases, automation_assessments, generated_scripts, exports.</li>
            <li className="rounded-md bg-slate-50 p-3">Storage bucket: requirement-documents.</li>
            <li className="rounded-md bg-slate-50 p-3">RLS policies keep user-owned project data scoped to each authenticated account.</li>
          </ul>
        </div>

        <div className="card p-5 xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-brand-blue" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Local MVP Workspace</h2>
                <p className="mt-1 text-sm text-slate-600">Sample project data is stored locally until Supabase is configured.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={clearLocalWorkspace} icon={<CheckCircle2 className="size-4" aria-hidden />}>
              Clear Local Data
            </Button>
          </div>
          {cleared ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">Local QAplanet data cleared.</p> : null}
        </div>

        <div className="card p-5 xl:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Project Data Management</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Reset the current project workflow when you want to start fresh while keeping the project name and description.
                This clears requirement sources, AI analysis items, generated test cases, automation scripts, and export records for the selected project only.
              </p>
            </div>
            <ResetProjectWorkflow />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
