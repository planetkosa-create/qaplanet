"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, LockKeyhole, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appStorageKeys, readJson } from "@/lib/storage";
import { sampleAnalysisItems, sampleRequirementSources } from "@/lib/phase2-sample-data";
import { sampleTestCases } from "@/lib/sample-data";
import type { Plan, UsageEvent } from "@/lib/types";

const plans: Plan[] = [
  { id: "free", name: "Free", monthlyPrice: 0, maxProjects: 1, maxDocuments: 5, maxAiGenerations: 20, maxTeamMembers: 1, features: ["Single project", "Core exports", "Local package downloads"] },
  { id: "pro", name: "Pro", monthlyPrice: 49, maxProjects: 5, maxDocuments: 100, maxAiGenerations: 500, maxTeamMembers: 3, features: ["More projects", "Advanced exports", "GitHub-ready packages"] },
  { id: "team", name: "Team", monthlyPrice: 149, maxProjects: "Unlimited", maxDocuments: "Unlimited", maxAiGenerations: 2000, maxTeamMembers: 15, features: ["Team collaboration", "Review workflow", "Execution dashboard"] },
  { id: "enterprise", name: "Enterprise", monthlyPrice: 0, maxProjects: "Unlimited", maxDocuments: "Unlimited", maxAiGenerations: "Unlimited", maxTeamMembers: "Unlimited", features: ["SSO ready", "Custom compliance", "Priority onboarding"] }
];

export default function BillingPage() {
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setUsageEvents(readJson(appStorageKeys.usageEvents, []));
  }, []);

  const usage = useMemo(() => {
    const documents = readJson(appStorageKeys.requirementSources, sampleRequirementSources).length;
    const analysisItems = readJson(appStorageKeys.analysisItems, sampleAnalysisItems).length;
    const testCases = readJson(appStorageKeys.testCases, sampleTestCases).length;
    const generatedAutomations = readJson(appStorageKeys.generatedAutomations, []).length;
    const exportHistory = readJson(appStorageKeys.exportHistory, []).length;

    return {
      document_uploaded: documents,
      ai_analysis_run: Math.max(analysisItems ? 1 : 0, countUsage(usageEvents, "ai_analysis_run")),
      test_cases_generated: testCases,
      automation_generated: generatedAutomations,
      export_created: exportHistory,
      package_generated: countUsage(usageEvents, "package_generated")
    };
  }, [usageEvents]);

  return (
    <AppShell>
      <PageHeader
        title="Billing"
        description="Review monetization-ready plan limits, workspace usage, and upgrade paths. Payments are marked coming soon for this phase."
      />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Stat title="Current plan" value="Free" icon={<CreditCard className="size-5" aria-hidden />} />
        <Stat title="AI generations used" value={`${usage.ai_analysis_run + usage.test_cases_generated + usage.automation_generated}`} icon={<Sparkles className="size-5" aria-hidden />} />
        <Stat title="Exports created" value={`${usage.export_created}`} icon={<BarChart3 className="size-5" aria-hidden />} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-4">
        {plans.map((plan) => (
          <article key={plan.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{plan.name}</h2>
                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {plan.name === "Enterprise" ? "Custom" : `$${plan.monthlyPrice}`}
                  {plan.name !== "Enterprise" ? <span className="text-sm font-semibold text-slate-500"> / mo</span> : null}
                </p>
              </div>
              {plan.name === "Free" ? <Badge tone="blue">Current</Badge> : <Badge>Coming soon</Badge>}
            </div>
            <dl className="mt-5 space-y-2 text-sm text-slate-600">
              <Row label="Projects" value={plan.maxProjects} />
              <Row label="Documents" value={plan.maxDocuments} />
              <Row label="AI generations" value={plan.maxAiGenerations} />
              <Row label="Team members" value={plan.maxTeamMembers} />
            </dl>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {plan.features.map((feature) => <li key={feature}>- {feature}</li>)}
            </ul>
            <Button
              className="mt-5 w-full"
              variant={plan.name === "Free" ? "secondary" : "primary"}
              disabled
              icon={<LockKeyhole className="size-4" aria-hidden />}
              onClick={() => setMessage("Upgrade flows are coming soon. Stripe is not enabled in Phase 4.")}
            >
              {plan.name === "Free" ? "Current Plan" : "Upgrade Coming Soon"}
            </Button>
          </article>
        ))}
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">Usage Summary</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Event type</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Phase 4 billing status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(usage).map(([eventType, quantity]) => (
                <tr key={eventType} className="table-row">
                  <td className="px-4 py-3 font-semibold text-slate-900">{eventType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{quantity}</td>
                  <td className="px-4 py-3"><Badge>Tracked for future billing</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
    </AppShell>
  );
}

function Stat({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-600">{title}</p>
        <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-brand-blue">{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function countUsage(events: UsageEvent[], eventType: UsageEvent["eventType"]) {
  return events.filter((event) => event.eventType === eventType).reduce((total, event) => total + event.quantity, 0);
}
