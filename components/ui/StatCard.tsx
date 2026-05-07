import type { ReactNode } from "react";

export function StatCard({ label, value, icon, hint }: { label: string; value: string | number; icon?: ReactNode; hint?: string }) {
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">{label}</p>
        {icon ? <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-brand-blue">{icon}</span> : null}
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </article>
  );
}
