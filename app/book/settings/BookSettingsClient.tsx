"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCcw, ShieldAlert } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { Card } from "@/app/book/components/ui/Card";
import { Button } from "@/app/book/components/ui/Button";
import { ChipButton } from "@/app/book/components/ui/Chip";
import { ConfirmModal } from "@/app/book/components/ui/ConfirmModal";
import { Toast } from "@/app/book/components/ui/Toast";
import { useToast } from "@/app/book/hooks/useToast";

const learningStyleOptions = [
  { id: "concise", label: "Simple" },
  { id: "balanced", label: "Standard" },
  { id: "deep", label: "Deeper" },
] as const;

const quizOptions = [
  { id: "easy", label: "Easy" },
  { id: "standard", label: "Standard" },
  { id: "challenging", label: "Challenging" },
] as const;

const fontOptions = [
  { id: "sm", label: "A-" },
  { id: "md", label: "A" },
  { id: "lg", label: "A+" },
] as const;

function clearBookLocalStorage() {
  const keysToDelete: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (key.startsWith("book-accelerator:")) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => window.localStorage.removeItem(key));
}

export function BookSettingsClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const { toast, showToast } = useToast();

  const {
    state: onboarding,
    hydrated: onboardingHydrated,
    setName,
    setDailyGoalMinutes,
    setReminderTime,
    setLearningStyle,
    setQuizIntensity,
    setStreakMode,
    resetSetup,
  } = useOnboardingState();

  const {
    state: preferences,
    hydrated: prefsHydrated,
    patch,
  } = useBookPreferences();

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

  if (!onboardingHydrated || !prefsHydrated || !onboarding.setupComplete) {
    return (
      <main className="relative min-h-screen text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-slate-300">
          Loading settings...
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
        activeTab="settings"
        searchQuery={query}
        onSearchChange={setQuery}
        searchInputRef={searchRef}
        searchPlaceholder="Search settings..."
      />

      <section className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-24 pt-7 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">Settings</h1>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <h2 className="text-lg font-semibold text-slate-100">Profile</h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-300 text-base font-semibold text-slate-900">
                {(onboarding.name || "R").trim().charAt(0).toUpperCase() || "R"}
              </span>
              <label className="flex-1">
                <span className="mb-1 block text-sm text-slate-400">Display name</span>
                <input
                  value={onboarding.name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => showToast("Profile updated", "success")}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-100">About</h2>
            <p className="mt-3 text-sm text-slate-300">Version: Book Accelerator UI v0.9.0</p>
            <p className="mt-2 text-sm text-slate-300">What's new: chapter reader, progress heatmap, session mode, badge rules.</p>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-slate-100">Reading preferences</h2>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-slate-400">Default reading depth</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {learningStyleOptions.map((option) => (
                  <ChipButton
                    key={option.id}
                    tone={onboarding.learningStyle === option.id ? "sky" : "neutral"}
                    active={onboarding.learningStyle === option.id}
                    onClick={() => {
                      setLearningStyle(option.id);
                      showToast("Reading depth updated", "success");
                    }}
                  >
                    {option.label}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-400">Default quiz difficulty</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quizOptions.map((option) => (
                  <ChipButton
                    key={option.id}
                    tone={onboarding.quizIntensity === option.id ? "sky" : "neutral"}
                    active={onboarding.quizIntensity === option.id}
                    onClick={() => {
                      setQuizIntensity(option.id);
                      showToast("Quiz difficulty updated", "success");
                    }}
                  >
                    {option.label}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-400">Daily goal ({onboarding.dailyGoalMinutes} min)</p>
              <input
                type="range"
                min={10}
                max={240}
                step={5}
                value={onboarding.dailyGoalMinutes}
                onChange={(event) => setDailyGoalMinutes(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={240}
                  value={onboarding.dailyGoalMinutes}
                  onChange={(event) => setDailyGoalMinutes(Number(event.target.value))}
                  className="w-24 rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-sm"
                />
                <span className="text-sm text-slate-400">minutes</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-slate-100">Notifications</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-400">Reminder time</span>
                <input
                  type="time"
                  value={onboarding.reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                Daily reminder
                <input
                  type="checkbox"
                  checked={preferences.dailyReminderEnabled}
                  onChange={(event) => patch({ dailyReminderEnabled: event.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                Streak reminder
                <input
                  type="checkbox"
                  checked={preferences.streakReminderEnabled}
                  onChange={(event) => patch({ streakReminderEnabled: event.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                Track streak mode
                <input
                  type="checkbox"
                  checked={onboarding.streakMode}
                  onChange={(event) => setStreakMode(event.target.checked)}
                />
              </label>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-100">Accessibility</h2>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm text-slate-400">Default font size</p>
                <div className="mt-2 inline-flex rounded-xl border border-white/20 p-0.5">
                  {fontOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => patch({ fontDefault: option.id })}
                      className={[
                        "rounded-lg px-3 py-1.5 text-sm transition",
                        preferences.fontDefault === option.id
                          ? "bg-white/14 text-slate-100"
                          : "text-slate-400 hover:bg-white/8",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                Reduced motion
                <input
                  type="checkbox"
                  checked={preferences.reducedMotion}
                  onChange={(event) => patch({ reducedMotion: event.target.checked })}
                />
              </label>
            </div>
          </Card>
        </div>

        <Card variant="danger">
          <h2 className="text-lg font-semibold text-rose-100">Data controls</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => showToast("Export will be available with backend sync.", "info")}
            >
              <Download className="h-4 w-4" />
              Export my data
            </Button>
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              <ShieldAlert className="h-4 w-4" />
              Reset all local data
            </Button>
          </div>
        </Card>
      </section>

      <ConfirmModal
        open={confirmReset}
        title="Reset all local data?"
        description="This clears onboarding, progress, notes, badges, and settings stored in your browser."
        confirmLabel="Reset data"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          clearBookLocalStorage();
          resetSetup();
          setConfirmReset(false);
          showToast("Local data reset", "success");
          router.push("/book");
        }}
      />

      <Toast open={toast.open} message={toast.message} tone={toast.tone} />

      <div className="pointer-events-none fixed bottom-6 right-6 hidden rounded-xl border border-white/20 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-300 md:inline-flex md:items-center md:gap-1.5">
        <RefreshCcw className="h-4 w-4" />
        Changes save automatically
      </div>
    </main>
  );
}
