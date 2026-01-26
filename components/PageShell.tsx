"use client";

import { useEffect, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { InteractiveBackground } from "@/components/InteractiveBackground";

export function PageShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Only force top on initial load (avoid fighting anchor navigation)
    if (!window.location.hash) window.scrollTo(0, 0);
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#070b16] text-slate-100">
      {/* Background is fixed inside the component, so it does NOT need an absolute wrapper */}
      <InteractiveBackground />

      <div className="relative z-10">
        <Navbar />
        {children}
      </div>
    </main>
  );
}
