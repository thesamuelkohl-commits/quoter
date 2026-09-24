import type { ReactNode } from "react";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar-bg py-5 md:flex">
        <div className="px-5 pb-6">
          <p className="text-sm font-semibold tracking-wide text-sidebar-fg">Orange Thread LIVE</p>
          <p className="text-xs text-sidebar-muted">Quoting &amp; Budget Estimator</p>
        </div>
        <SidebarNav />
      </aside>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3 md:hidden">
          <p className="text-sm font-semibold">OTL Quoting</p>
        </header>
        <main className="flex-1 px-6 py-8 md:px-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
