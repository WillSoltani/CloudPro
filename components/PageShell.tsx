import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";

type Props = {
  children: ReactNode;
  /** Extra classes for <main> (e.g. a next/font variable so `font-serif` resolves below it). */
  className?: string;
};

export function PageShell({ children, className }: Props) {
  return (
    <>
      <a
        href="#about"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:border focus:border-lamp/50 focus:bg-night focus:px-4 focus:py-2 focus:font-mono focus:text-[11px] focus:tracking-[0.18em] focus:text-slate-100 focus:uppercase focus:ring-2 focus:ring-lamp"
      >
        Skip to content
      </a>
      {/* The banner landmark before <main> in reading order; it is position: fixed, so where it sits in the DOM
          does not move it (and its z-50 still clears everything in <main>). Same surface, so the same tap flash. */}
      <div data-surface="portfolio">
        <Navbar />
      </div>
      {/* overflow-x-clip, not -hidden: a hidden overflow would make <main> the scroll container and break the film's sticky stage. */}
      <main
        data-surface="portfolio"
        className={["relative min-h-screen w-full overflow-x-clip text-slate-100", className]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="relative z-10">{children}</div>
      </main>
    </>
  );
}
