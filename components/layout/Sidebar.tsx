"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Bot,
  Code2,
  Download,
  FileCheck2,
  Gauge,
  GitBranch,
  HelpCircle,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  UploadCloud,
  X
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requirements-upload", label: "Requirements Upload", icon: UploadCloud },
  { href: "/ai-analysis", label: "AI Analysis", icon: Bot },
  { href: "/test-case-generator", label: "Test Case Generator", icon: FileCheck2 },
  { href: "/automation-readiness", label: "Automation Readiness", icon: Gauge },
  { href: "/code-generation", label: "Code Generation", icon: Code2 },
  { href: "/traceability", label: "Traceability", icon: GitBranch },
  { href: "/export-center", label: "Export Center", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white shadow-2xl transition-transform lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
            <Link href="/" className="flex min-w-0 items-center gap-3" onClick={onClose}>
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-blue-50 ring-1 ring-blue-100">
                <Image src="/brand/planetkosa-logo.svg" alt="" width={48} height={48} className="size-12 object-cover" priority />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-bold tracking-tight text-slate-950">QAplanet</span>
                <span className="block truncate text-xs font-semibold text-slate-500">A PlanetKosa product</span>
              </span>
            </Link>
            <button className="focus-ring rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={onClose} aria-label="Close menu">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Primary">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || legacyPathMatches(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={clsx(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                    active
                      ? "bg-brand-blue text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  )}
                >
                  <Icon className={clsx("size-5", active ? "text-white" : "text-slate-500 group-hover:text-brand-blue")} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-4 border-t border-slate-200 p-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                <MessageSquareText className="size-4 text-brand-blue" aria-hidden />
                QAplanet Assistant
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Ask questions about your requirements and tests.</p>
              <button className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md bg-white px-3 text-xs font-bold text-brand-blue shadow-sm ring-1 ring-blue-100 hover:bg-blue-50">
                <HelpCircle className="size-4" aria-hidden />
                Chat Now
              </button>
            </div>
            <div className="text-xs leading-5 text-slate-500">
              <p>© 2024 QAplanet</p>
              <p>A PlanetKosa product v1.0.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function legacyPathMatches(pathname: string, href: string) {
  const legacy: Record<string, string> = {
    "/requirements-upload": "/upload",
    "/ai-analysis": "/analysis",
    "/test-case-generator": "/test-cases",
    "/export-center": "/exports"
  };
  return legacy[href] === pathname;
}
