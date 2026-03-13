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

  const timeline = useMemo(
    () => [
      {
        label: "First chapter completed",
        done: (analytics?.totalCompletedChapters ?? 0) >= 1,
      },
      {
        label: "First quiz passed",
        done: (analytics?.avgQuizScore ?? 0) > 0,
      },
      {
        label: "7-day streak unlocked",
        done: (analytics?.streakDays ?? 0) >= 7,
      },
      {
        label: "First book completed",
        done: (analytics?.booksCompleted ?? 0) >= 1,
      },
      {
        label: "Quiz Master pace",
        done: (analytics?.avgQuizScore ?? 0) >= 90,
      },
    ],
    [analytics]
  );

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

      <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">Badges</h1>
          {badges.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-300/12 px-3 py-1 text-amber-100">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                {badges.filter((b) => b.earned).length} earned
              </span>
              <span className="text-slate-500">{badges.filter((b) => !b.earned).length} locked</span>
            </div>
          )}
        </div>

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
            {displayedBadges.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No badges match this filter.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayedBadges.map((badge) => (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => setSelectedBadge(badge)}
                    className={[
                      "group rounded-2xl border p-4 text-left transition duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
                      badge.earned
                        ? "border-amber-300/35 bg-[linear-gradient(140deg,rgba(251,191,36,0.14),rgba(251,191,36,0.06))] hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(251,191,36,0.22)]"
                        : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={["text-3xl", !badge.earned && "opacity-40 grayscale"].join(" ")}>{badge.icon}</p>
                      {!badge.earned ? <Lock className="h-3.5 w-3.5 text-slate-600" /> : null}
                    </div>
                    <p className={["mt-3 text-sm font-semibold", badge.earned ? "text-amber-100" : "text-slate-500"].join(" ")}>{badge.name}</p>
                    <p className={["mt-0.5 text-xs", badge.earned ? "text-amber-300/70" : "text-slate-600"].join(" ")}>
                      {badge.earned ? "Earned" : badge.category}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-100">Milestones</h2>
            <ol className="mt-4 space-y-0">
              {timeline.map((item, index) => {
                const done = item.done;
                const isLast = index === timeline.length - 1;
                return (
                  <li key={item.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={[
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold",
                          done
                            ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-300"
                            : "border-white/15 bg-white/5 text-slate-600",
                        ].join(" ")}
                      >
                        {done ? "✓" : index + 1}
                      </span>
                      {!isLast && (
                        <span className={["w-px flex-1 my-1", done ? "bg-emerald-500/30" : "bg-white/8"].join(" ")} />
                      )}
                    </div>
                    <p className={["pb-4 pt-0.5 text-sm leading-snug", done ? "text-slate-200" : "text-slate-500"].join(" ")}>
                      {item.label}
                    </p>
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
            <div className="rounded-xl border border-white/12 bg-white/3 p-3 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">How to earn</p>
              <p className="mt-1">{selectedBadge.howToEarn}</p>
              <p className="mt-2 text-xs text-slate-400">
                {selectedBadge.earned
                  ? selectedBadge.earnedAt
                    ? `Earned on ${new Date(selectedBadge.earnedAt).toLocaleDateString()}`
                    : "Earned"
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
