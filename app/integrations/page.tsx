"use client";

import { Bell, Github, Mail, PlugZap, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const integrations = [
  {
    name: "Azure DevOps",
    status: "Export enabled",
    description: "Export QAplanet test cases as Azure DevOps import-ready CSV files.",
    action: "Use Export Center",
    enabled: true,
    icon: PlugZap
  },
  {
    name: "Jira / Xray",
    status: "Export enabled",
    description: "Export Jira CSV, Xray JSON, and Markdown test plans for test management import.",
    action: "Use Export Center",
    enabled: true,
    icon: Settings2
  },
  {
    name: "GitHub",
    status: "ZIP enabled",
    description: "Generate GitHub-ready automation packages. Live repository push is coming soon.",
    action: "Generate ZIP",
    enabled: true,
    icon: Github
  },
  {
    name: "Slack notifications",
    status: "Not connected",
    description: "Notify channels when analysis, generation, review, or execution events complete.",
    action: "Coming soon",
    enabled: false,
    icon: Bell
  },
  {
    name: "Email notifications",
    status: "Not connected",
    description: "Send review requests, approval notices, and execution result summaries by email.",
    action: "Coming soon",
    enabled: false,
    icon: Mail
  }
];

export default function IntegrationsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Integrations"
        description="Review enabled export integrations and the live API connection roadmap for QAplanet."
      />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <article key={integration.name} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-brand-blue">
                  <Icon className="size-5" aria-hidden />
                </span>
                <Badge tone={integration.enabled ? "teal" : "neutral"}>{integration.status}</Badge>
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-950">{integration.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{integration.description}</p>
              <Button className="mt-5" variant={integration.enabled ? "secondary" : "ghost"} disabled={!integration.enabled}>
                {integration.action}
              </Button>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
