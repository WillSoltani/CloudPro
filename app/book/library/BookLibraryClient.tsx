"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import {
  LIBRARY_CATEGORY_OPTIONS,
  LIBRARY_DIFFICULTY_OPTIONS,
  LIBRARY_SORT_OPTIONS,
  LIBRARY_STATUS_OPTIONS,
  buildLibraryCatalog,
} from "@/app/book/data/mockUserLibraryState";
import { useLibraryFilters } from "@/app/book/library/hooks/useLibraryFilters";
import { LibrarySearchBar } from "@/app/book/library/components/LibrarySearchBar";
import { LibraryFilters } from "@/app/book/library/components/LibraryFilters";
import { BookCardLarge } from "@/app/book/library/components/BookCardLarge";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="h-72 rounded-2xl bg-slate-800/55 sm:h-80" />
      <div className="mt-4 h-7 w-2/3 rounded bg-slate-800/55" />
      <div className="mt-2 h-5 w-1/2 rounded bg-slate-800/45" />
      <div className="mt-3 h-8 w-full rounded bg-slate-800/40" />
      <div className="mt-4 h-2.5 w-full rounded bg-slate-800/45" />
    </div>
  );
}

export function BookLibraryClient() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();

  const libraryEntries = useMemo(() => buildLibraryCatalog(), []);
  const {
    hydrated,
    loading,
    filters,
    displayedEntries,
    totalCount,
    setSearchQuery,
    setCategory,
    setDifficulty,
    setStatus,
    setSort,
    clearChipFilters,
    hasActiveChipFilters,
  } = useLibraryFilters(libraryEntries);

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      searchInputRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  if (!onboardingHydrated || !hydrated || !onboarding.setupComplete) {
    return (
      <main className="relative min-h-screen text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-slate-300">
          Loading library...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(980px_circle_at_8%_-8%,rgba(56,189,248,0.12),transparent_58%),radial-gradient(820px_circle_at_100%_0%,rgba(251,191,36,0.08),transparent_52%)]" />

      <TopNav
        name={onboarding.name || "Reader"}
        activeTab="library"
        searchQuery={filters.searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        showSearch={false}
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-20 pt-7 sm:px-6 sm:pt-8">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h1 className="text-5xl font-semibold tracking-tight text-slate-50">Library</h1>
          <p className="text-sm text-slate-400">{totalCount} books</p>
        </div>

        <LibrarySearchBar
          value={filters.searchQuery}
          onChange={setSearchQuery}
          inputRef={searchInputRef}
          sortValue={filters.sort}
          onSortChange={setSort}
          sortOptions={LIBRARY_SORT_OPTIONS}
        />

        <div className="mt-4">
          <LibraryFilters
            category={filters.category}
            difficulty={filters.difficulty}
            status={filters.status}
            categoryOptions={LIBRARY_CATEGORY_OPTIONS}
            difficultyOptions={LIBRARY_DIFFICULTY_OPTIONS}
            statusOptions={LIBRARY_STATUS_OPTIONS}
            onCategoryChange={setCategory}
            onDifficultyChange={setDifficulty}
            onStatusChange={setStatus}
            showClearFilters={hasActiveChipFilters}
            onClearFilters={clearChipFilters}
          />
        </div>

        <div className="mt-6 border-t border-white/10 pt-6">
          {onboarding.selectedBookIds.length === 0 ? (
            <div className="rounded-3xl border border-white/12 bg-white/[0.03] px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold text-slate-100">
                Your library is empty.
              </h2>
              <p className="mt-2 text-slate-300">
                Finish setup to pick your first books and start your reading path.
              </p>
              <button
                type="button"
                onClick={() => router.push("/book")}
                className="mt-5 rounded-2xl border border-sky-300/35 bg-sky-400/15 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-400/22"
              >
                Add books
              </button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : displayedEntries.length === 0 ? (
            <div className="rounded-3xl border border-white/12 bg-white/[0.03] px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold text-slate-100">
                No books match your filters.
              </h2>
              <p className="mt-2 text-slate-300">
                Try clearing your filters or searching for a different title.
              </p>
              <button
                type="button"
                onClick={clearChipFilters}
                className="mt-5 rounded-2xl border border-sky-300/35 bg-sky-400/15 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-400/22"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {displayedEntries.map((entry) => (
                <BookCardLarge
                  key={entry.id}
                  entry={entry}
                  onOpen={() => router.push(`/book/library/${encodeURIComponent(entry.id)}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
