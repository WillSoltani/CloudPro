"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TopNav, type BookNavTab } from "@/app/book/home/components/TopNav";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";

type BookSectionPlaceholderProps = {
  activeTab: BookNavTab;
  name: string;
  title: string;
  subtitle: string;
};

export function BookSectionPlaceholder({
  activeTab,
  name,
  title,
  subtitle,
}: BookSectionPlaceholderProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      inputRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  return (
    <main className="relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(980px_circle_at_8%_-8%,rgba(56,189,248,0.12),transparent_58%),radial-gradient(820px_circle_at_100%_0%,rgba(251,191,36,0.08),transparent_52%)]" />

      <TopNav
        name={name}
        activeTab={activeTab}
        searchQuery={query}
        onSearchChange={setQuery}
        searchInputRef={inputRef}
      />

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <Link
          href="/book/workspace"
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mt-7 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 shadow-[0_24px_65px_rgba(2,6,23,0.55)]">
          <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-300">{subtitle}</p>
          <p className="mt-6 inline-flex rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-200">
            This section is in UI-preview mode and will be connected next.
          </p>
        </div>
      </section>
    </main>
  );
}
