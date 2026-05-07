"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Code2,
  Download,
  FileCheck2,
  FileText,
  Gauge,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Requirements Upload", icon: UploadCloud },
  { href: "/analysis", label: "AI Analysis", icon: Bot },
  { href: "/test-cases", label: "Test Case Generator", icon: FileCheck2 },
  { href: "/automation-readiness", label: "Automation Readiness", icon: Gauge },
  { href: "/code-generation", label: "Code Generation", icon: Code2 },
  { href: "/exports", label: "Export Center", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          <Link href="/" className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
            <span className="grid size-11 place-items-center rounded-lg bg-brand-blue text-white">
              <ShieldCheck className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-bold text-slate-950">QAplanet</span>
              <span className="text-xs font-medium text-slate-500">qaplanet.ca</span>
            </span>
          </Link>

          <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Primary">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition",
                    active
                      ? "bg-blue-50 text-brand-blue"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <BarChart3 className="size-4 text-brand-teal" aria-hidden />
                MVP Workspace
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Supabase and OpenAI are wired through environment variables.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="grid size-9 place-items-center rounded-md bg-brand-blue text-white">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <span className="font-bold text-slate-950">QAplanet</span>
            </Link>
            <div className="hidden text-sm font-medium text-slate-500 lg:block">
              Turn requirements into test cases and automation.
            </div>
            <Link
              href="/login"
              className="focus-ring rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Login
            </Link>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden" aria-label="Mobile primary">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold",
                    active ? "bg-blue-50 text-brand-blue" : "text-slate-600"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
