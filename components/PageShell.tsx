import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { InteractiveBackground } from "@/components/InteractiveBackground";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#070b16] text-slate-100">
      {/* Client-only background */}
      <InteractiveBackground />

      <div className="relative z-10">
        <Navbar />
        {children}
      </div>
    </main>
  );
}
