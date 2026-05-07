"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";

export function AppShell({ children, rightRail }: { children: ReactNode; rightRail?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
