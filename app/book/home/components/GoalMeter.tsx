"use client";

import { formatMinutesLabel } from "@/app/book/components/GoalPicker";

type GoalMeterProps = {
  goalMinutes: number;
  minutesReadToday: number;
  onAddTenMinutes: () => void;
};

export function GoalMeter({
  goalMinutes,
  minutesReadToday,
  onAddTenMinutes,
}: GoalMeterProps) {
  const progress = Math.min(100, Math.round((minutesReadToday / goalMinutes) * 100));
  const safeProgress = Number.isFinite(progress) ? progress : 0;

  return (
    <article className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5">
      <h3 className="text-lg font-semibold text-slate-100">Goal Meter</h3>
      <p className="mt-1 text-sm text-slate-300">Daily reading target progress</p>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="relative h-20 w-20 rounded-full"
          style={{
            background: `conic-gradient(rgb(56 189 248) ${safeProgress * 3.6}deg, rgba(148,163,184,0.25) 0deg)`,
          }}
        >
          <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-[#0b1120] text-sm font-semibold text-slate-100">
            {safeProgress}%
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-300">
            {formatMinutesLabel(minutesReadToday)} / {formatMinutesLabel(goalMinutes)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {Math.max(goalMinutes - minutesReadToday, 0)} min left today
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onAddTenMinutes}
        className="mt-4 rounded-xl border border-sky-300/30 bg-sky-400/12 px-3 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
      >
        Mark 10 minutes done
      </button>
    </article>
  );
}

