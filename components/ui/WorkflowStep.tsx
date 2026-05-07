import type { ReactNode } from "react";

export function WorkflowStep({ step, title, description, icon }: { step: string; title: string; description: string; icon?: ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-sm font-bold text-brand-blue">{icon ?? step}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{step}</p>
          <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}
