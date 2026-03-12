"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { BookNavTab } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { BookSectionPlaceholder } from "@/app/book/components/BookSectionPlaceholder";

type BookSectionPlaceholderClientProps = {
  activeTab: BookNavTab;
  title: string;
  subtitle: string;
};

export function BookSectionPlaceholderClient({
  activeTab,
  title,
  subtitle,
}: BookSectionPlaceholderClientProps) {
  const router = useRouter();
  const { state, hydrated } = useOnboardingState();

  useEffect(() => {
    if (!hydrated) return;
    if (!state.setupComplete) {
      router.replace("/book");
    }
  }, [hydrated, router, state.setupComplete]);

  if (!hydrated || !state.setupComplete) {
    return (
      <main className="relative min-h-screen text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-slate-300">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <BookSectionPlaceholder
      activeTab={activeTab}
      name={state.name || "Reader"}
      title={title}
      subtitle={subtitle}
    />
  );
}

