"use client";

import { useEffect, type ReactNode } from "react";
import { Navbar } from "@/src/components/Navbar";

export function PageShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="relative min-h-screen text-slate-100">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0a1020]" />

        {/* top glow */}
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_10%,rgba(56,189,248,0.12),transparent_60%)]" />

        {/* side tint */}
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_10%_40%,rgba(139,92,246,0.10),transparent_65%)]" />

        {/* subtle vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_40%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />

      </div>

      <Navbar />
      {children}
    </main>
  );
}
