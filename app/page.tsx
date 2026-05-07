import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Code2, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const capabilities = [
  {
    icon: FileText,
    title: "Analyze requirements",
    description: "Upload BRDs, user stories, acceptance criteria, test plans, PDFs, DOCX, XLSX, or plain text."
  },
  {
    icon: Bot,
    title: "Generate QA assets",
    description: "Extract business rules, risks, gaps, assumptions, and structured enterprise test cases."
  },
  {
    icon: Code2,
    title: "Create automation",
    description: "Assess automation readiness and generate Playwright TypeScript scripts for selected cases."
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-brand-blue text-white">
              <ShieldCheck className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-bold text-slate-950">QAplanet</span>
              <span className="text-xs font-medium text-slate-500">qaplanet.ca</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/login">
              Login
            </Link>
            <Link href="/dashboard">
              <Button icon={<ArrowRight className="size-4" aria-hidden />}>Open App</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <Badge tone="teal">Turn requirements into test cases and automation.</Badge>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">QAplanet</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Upload requirements, analyze business intent, generate structured test cases, identify automation candidates,
              and produce clean Playwright TypeScript scripts from one focused QA workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/upload">
                <Button icon={<FileText className="size-4" aria-hidden />}>Upload Requirements</Button>
              </Link>
              <Link href="/test-cases">
                <Button variant="secondary" icon={<CheckCircle2 className="size-4" aria-hidden />}>
                  View Sample Test Cases
                </Button>
              </Link>
            </div>
          </div>

          <div className="card self-end p-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Customer portal BRD</p>
                  <p className="text-xs text-slate-500">AI analysis ready</p>
                </div>
                <Badge tone="blue">8 gaps found</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Business rules", "User stories", "Acceptance criteria", "Risk review"].map((item, index) => (
                  <div key={item} className="rounded-md border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                    <p className="mt-2 font-semibold text-slate-950">{item}</p>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-brand-teal" style={{ width: `${66 + index * 8}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md bg-brand-navy p-4 text-white">
                <p className="text-sm font-semibold">Playwright output</p>
                <pre className="mt-3 overflow-hidden rounded-md bg-slate-950 p-3 text-xs text-slate-200">
                  {`test.describe("Customer login", () => {
  test("valid user signs in", async ({ page }) => {
    await page.goto(process.env.APP_URL!);
    await expect(page.getByRole("heading")).toBeVisible();
  });
});`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        {capabilities.map((capability) => {
          const Icon = capability.icon;
          return (
            <article key={capability.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
              <Icon className="size-6 text-brand-blue" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{capability.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{capability.description}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
