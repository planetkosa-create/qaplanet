"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, HelpCircle, Loader2, LogOut, Menu, Search, Settings, UserCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { clearQaPlanetLocalData } from "@/lib/storage";

type UserDisplay = {
  name: string;
  email: string;
  role: string;
};

export function TopHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<UserDisplay>({ name: "Alex Morgan", email: "alex.morgan@qaplanet.ca", role: "QA Manager" });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

      setUser({ name, email: authUser.email ?? "No email available", role: "QA Manager" });
    }

    void loadUser();
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      clearQaPlanetLocalData();
      setDropdownOpen(false);
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

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
          <div className="relative z-50 ml-1 hidden sm:block" ref={dropdownRef}>
            <button
              type="button"
              className="focus-ring flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:bg-slate-50"
              onPointerDown={(event) => {
                event.stopPropagation();
                setDropdownOpen((open) => !open);
              }}
              onClick={(event) => event.preventDefault()}
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
            >
              <span className="grid size-9 place-items-center rounded-full bg-brand-blue text-xs font-bold text-white">{initials}</span>
              <span>
                <span className="block text-sm font-bold text-slate-950">{user.name}</span>
                <span className="block text-xs font-semibold text-slate-500">{user.role}</span>
              </span>
              <ChevronDown className={`size-4 text-slate-500 transition ${dropdownOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>

            {dropdownOpen ? (
              <div
                className="absolute right-0 top-full z-[80] mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft"
                onPointerDown={(event) => event.stopPropagation()}
                role="menu"
              >
                <div className="px-4 py-3">
                  <p className="truncate text-sm font-bold text-slate-950">{user.name}</p>
                  <p className="mt-1 truncate text-xs font-medium text-slate-500">{user.email}</p>
                </div>
                <div className="border-t border-slate-100 py-1">
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setDropdownOpen(false)}
                    role="menuitem"
                  >
                    <UserCircle className="size-4 text-slate-500" aria-hidden />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setDropdownOpen(false)}
                    role="menuitem"
                  >
                    <Settings className="size-4 text-slate-500" aria-hidden />
                    Settings
                  </Link>
                </div>
                <div className="border-t border-slate-100 py-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={signOut}
                    disabled={signingOut}
                    role="menuitem"
                  >
                    {signingOut ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
                    {signingOut ? "Signing out" : "Sign out"}
                  </button>
                </div>
              </div>
            ) : null}
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
