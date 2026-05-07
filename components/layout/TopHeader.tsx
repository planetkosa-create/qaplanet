"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Bell, HelpCircle, Menu, Search } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type UserDisplay = {
  name: string;
  role: string;
};

export function TopHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const [user, setUser] = useState<UserDisplay>({ name: "Alex Morgan", role: "QA Manager" });

  useEffect(() => {
    async function loadUser() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        return;
      }
      const result = await supabase.auth.getUser();
      const authUser = result.data.user;
      if (!authUser) {
        return;
      }

      const name =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split("@")[0] ||
        "QA Manager";

      setUser({ name, role: "QA Manager" });
    }

    void loadUser();
  }, []);

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AM";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <button className="focus-ring rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 lg:hidden" onClick={onMenuClick} aria-label="Open menu">
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-950 sm:text-xl">AI Test Case & Automation Builder</h1>
            <p className="hidden max-w-3xl truncate text-sm text-slate-500 md:block">
              Upload requirements, generate test cases, identify automation candidates, and create automation scripts.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <IconButton label="Search"><Search className="size-5" aria-hidden /></IconButton>
          <button className="focus-ring relative hidden rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 sm:inline-flex" aria-label="Notifications">
            <Bell className="size-5" aria-hidden />
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-brand-blue text-[10px] font-bold text-white">3</span>
          </button>
          <IconButton label="Help"><HelpCircle className="size-5" aria-hidden /></IconButton>
          <div className="ml-1 hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
            <span className="grid size-9 place-items-center rounded-full bg-brand-blue text-xs font-bold text-white">{initials}</span>
            <span>
              <span className="block text-sm font-bold text-slate-950">{user.name}</span>
              <span className="block text-xs font-semibold text-slate-500">{user.role}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button className="focus-ring hidden rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 sm:inline-flex" aria-label={label}>
      {children}
    </button>
  );
}
