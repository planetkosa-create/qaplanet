import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { AutomationReadiness, Priority, TestCaseStatus } from "@/lib/types";

const readinessStyles: Record<AutomationReadiness, string> = {
  Automatable: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Needs API/Data": "bg-amber-50 text-amber-700 ring-amber-200",
  "Manual Only": "bg-slate-100 text-slate-700 ring-slate-200"
};

const priorityStyles: Record<Priority, string> = {
  Critical: "bg-rose-50 text-rose-700 ring-rose-200",
  High: "bg-orange-50 text-orange-700 ring-orange-200",
  Medium: "bg-blue-50 text-blue-700 ring-blue-200",
  Low: "bg-slate-100 text-slate-700 ring-slate-200"
};

const statusStyles: Record<TestCaseStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 ring-slate-200",
  "In Review": "bg-blue-50 text-blue-700 ring-blue-200",
  Approved: "bg-teal-50 text-teal-700 ring-teal-200",
  Rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  "Needs Update": "bg-amber-50 text-amber-700 ring-amber-200"
};

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "teal";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tone === "blue" && "bg-blue-50 text-blue-700 ring-blue-200",
        tone === "teal" && "bg-teal-50 text-teal-700 ring-teal-200",
        tone === "neutral" && "bg-slate-100 text-slate-700 ring-slate-200",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ReadinessBadge({ value }: { value: AutomationReadiness }) {
  return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", readinessStyles[value])}>{value}</span>;
}

export function PriorityBadge({ value }: { value: Priority }) {
  return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", priorityStyles[value])}>{value}</span>;
}

export function StatusBadge({ value }: { value: TestCaseStatus }) {
  return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", statusStyles[value])}>{value}</span>;
}
