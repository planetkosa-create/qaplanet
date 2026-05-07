import { CheckCircle2, ShieldCheck } from "lucide-react";

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
        <div className="space-y-3 bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white">
          <ShieldCheck className="size-6" aria-hidden />
          <div>
            <h2 className="text-base font-bold">Enterprise Grade Security</h2>
            <p className="mt-2 text-sm font-semibold text-blue-100">SOC 2 Type II &bull; GDPR Compliant</p>
          </div>
          <p className="text-sm leading-6 text-blue-50">Your data is encrypted and secure.</p>
          <a className="inline-flex text-sm font-medium text-white/90 underline-offset-4 hover:text-white hover:underline" href="/settings">
            Learn more &rarr;
          </a>
        </div>
      </section>
    </aside>
  );
}
