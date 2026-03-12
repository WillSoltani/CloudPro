"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Share2 } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { evaluateBadges, type BadgeState } from "@/app/book/data/mockBadges";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { Card } from "@/app/book/components/ui/Card";
import { ChipButton } from "@/app/book/components/ui/Chip";
import { InfoModal } from "@/app/book/home/components/InfoModal";
import { Button } from "@/app/book/components/ui/Button";
import { Toast } from "@/app/book/components/ui/Toast";
import { useToast } from "@/app/book/hooks/useToast";

type BadgeFilter = "All" | "Earned" | "Locked" | "Streak" | "Quiz" | "Books";

const filters: BadgeFilter[] = ["All", "Earned", "Locked", "Streak", "Quiz", "Books"];

function filterBadges(badges: BadgeState[], filter: BadgeFilter): BadgeState[] {
  if (filter === "All") return badges;
  if (filter === "Earned") return badges.filter((badge) => badge.earned);
  if (filter === "Locked") return badges.filter((badge) => !badge.earned);
  return badges.filter((badge) => badge.category === filter);
}

const timeline = [
  "First chapter completed",
  "First quiz passed",
  "7-day streak unlocked",
  "First book completed",
  "Quiz Master pace",
];

export function BookBadgesClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BadgeFilter>("All");
  const [selectedBadge, setSelectedBadge] = useState<BadgeState | null>(null);

  const { toast, showToast } = useToast();

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { analytics, hydrated } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      searchRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  const badges = useMemo(() => {
    if (!analytics) return [];
    return evaluateBadges({
      totalCompletedChapters: analytics.totalCompletedChapters,
      completedBooks: analytics.booksCompleted,
      streakDays: analytics.streakDays,
      avgQuizScore: analytics.avgQuizScore,
      maxQuizScore: analytics.maxQuizScore,
      longestStreak: analytics.longestStreak,
    });
  }, [analytics]);

  const displayedBadges = useMemo(() => {
    const byFilter = filterBadges(badges, filter);
    const search = query.trim().toLowerCase();
    if (!search) return byFilter;
    return byFilter.filter((badge) => {
      const text = `${badge.name} ${badge.description} ${badge.category}`.toLowerCase();
      return text.includes(search);
    });
  }, [badges, filter, query]);

  if (!onboardingHydrated || !hydrated || !onboarding.setupComplete) {
    return (
      <main className="relative min-h-screen text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-slate-300">
          Loading badges...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(920px_circle_at_10%_-8%,rgba(56,189,248,0.12),transparent_58%),radial-gradient(820px_circle_at_100%_0%,rgba(251,191,36,0.08),transparent_52%)]" />

      <TopNav
        name={onboarding.name || "Reader"}
        activeTab="badges"
        searchQuery={query}
        onSearchChange={setQuery}
        searchInputRef={searchRef}
        searchPlaceholder="Search badges..."
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-24 pt-7 sm:px-6 sm:pt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">Badges</h1>

        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((option) => (
            <ChipButton
              key={option}
              tone={filter === option ? "sky" : "neutral"}
              active={filter === option}
              onClick={() => setFilter(option)}
            >
              {option}
            </ChipButton>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {displayedBadges.map((badge) => (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setSelectedBadge(badge)}
                  className={[
                    "group rounded-2xl border p-4 text-left transition duration-200",
                    badge.earned
                      ? "border-amber-300/35 bg-amber-500/14 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(251,191,36,0.22)]"
                      : "border-white/10 bg-white/[0.03] opacity-75 hover:border-white/20",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-3xl">{badge.icon}</p>
                    {!badge.earned ? <Lock className="h-4 w-4 text-slate-500" /> : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-100">{badge.name}</p>
                  <p className="mt-1 text-xs text-slate-300">{badge.category}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-100">Milestones timeline</h2>
            <ol className="mt-3 space-y-2">
              {timeline.map((item, index) => {
                const done = index < Math.min(4, (analytics?.booksCompleted ?? 0) + 2);
                return (
                  <li key={item} className="flex gap-2">
                    <span
                      className={[
                        "mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
                        done ? "bg-emerald-300" : "bg-slate-600",
                      ].join(" ")}
                    />
                    <span className={done ? "text-slate-100" : "text-slate-400"}>{item}</span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </section>

      <InfoModal
        open={Boolean(selectedBadge)}
        title={selectedBadge?.name || "Badge"}
        onClose={() => setSelectedBadge(null)}
      >
        {selectedBadge ? (
          <div className="space-y-3">
            <p className="text-4xl">{selectedBadge.icon}</p>
            <p className="text-sm text-slate-200">{selectedBadge.description}</p>
            <div className="rounded-xl border border-white/12 bg-white/[0.03] p-3 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">How to earn</p>
              <p className="mt-1">{selectedBadge.howToEarn}</p>
              <p className="mt-2 text-xs text-slate-400">
                {selectedBadge.earned
                  ? `Earned on ${new Date(selectedBadge.earnedAt || Date.now()).toLocaleDateString()}`
                  : "Not earned yet"}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => showToast("Share link copied (UI demo).", "success")}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        ) : null}
      </InfoModal>

      <Toast open={toast.open} message={toast.message} tone={toast.tone} />
    </main>
  );
}
