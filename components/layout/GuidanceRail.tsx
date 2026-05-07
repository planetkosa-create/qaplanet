import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const readinessItems = [
  "Defined user roles and permissions",
  "Supported input formats",
  "Standard test case template",
  "Automation framework choice",
  "Integration targets",
  "LLM / AI model strategy",
  "Traceability from requirement to test case to automation",
  "Review and approval workflow",
  "Storage and security requirements",
  "Reporting and export needs"
];

export function GuidanceRail() {
  return (
    <aside className="space-y-5">
      <section className="card p-5">
        <h2 className="text-base font-bold text-slate-950">What You Need Before Development</h2>
        <ul className="mt-4 space-y-3">
          {readinessItems.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-5 text-slate-600">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white">
          <ShieldCheck className="size-6" aria-hidden />
          <h2 className="mt-4 text-base font-bold">Enterprise Grade Security</h2>
          <p className="mt-2 text-sm font-semibold text-blue-100">SOC 2 Type II • GDPR Compliant</p>
          <p className="mt-3 text-sm leading-6 text-blue-50">Your data is encrypted and secure.</p>
          <Button className="mt-4 bg-white text-brand-blue hover:bg-blue-50" type="button">Learn more</Button>
        </div>
      </section>
    </aside>
  );
}
