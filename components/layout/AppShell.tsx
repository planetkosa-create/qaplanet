"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

export function AppShell({ children, rightRail }: { children: ReactNode; rightRail?: ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function protectWorkspace() {
      if (!hasSupabaseConfig()) {
        return;
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        return;
      }

      const result = await supabase.auth.getUser();
      if (!result.data.user) {
        clearLocalQaPlanetState();
        router.replace("/login");
      }
    }

    void protectWorkspace();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-72">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
          {rightRail ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0">{children}</div>
              <div className="min-w-0">{rightRail}</div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function clearLocalQaPlanetState() {
  if (typeof window === "undefined") {
    return;
  }

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("qaplanet."))
    .forEach((key) => window.localStorage.removeItem(key));
}
