"use client";

import { CheckCircle2, Circle, Clock3, PlayCircle } from "lucide-react";
import type { SessionTask } from "@/app/book/data/mockProgress";

type TodaySessionCardProps = {
  tasks: SessionTask[];
  onToggleTask: (taskId: string) => void;
  onStartSession: () => void;
};

export function TodaySessionCard({
  tasks,
  onToggleTask,
  onStartSession,
}: TodaySessionCardProps) {
  const totalMinutes = tasks.reduce((sum, item) => sum + item.minutes, 0);

  return (
    <article className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_16px_42px_rgba(2,6,23,0.48)] sm:p-6">
      <h3 className="text-2xl font-semibold text-slate-100">Today's Session</h3>
      <p className="mt-1 text-sm text-slate-300">Your focused plan for today</p>

      <ul className="mt-4 space-y-2.5">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => onToggleTask(task.id)}
              className="inline-flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-slate-200"
            >
              {task.complete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Circle className="h-4 w-4 text-slate-400" />
              )}
              <span className={task.complete ? "line-through text-slate-400" : ""}>
                {task.label}
              </span>
            </button>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Clock3 className="h-3.5 w-3.5" />
              {task.minutes} min
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <p className="text-sm text-slate-300">Estimated total</p>
        <p className="text-sm font-semibold text-slate-100">~{totalMinutes} min</p>
      </div>

      <button
        type="button"
        onClick={onStartSession}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_12px_24px_rgba(250,204,21,0.32)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
      >
        <PlayCircle className="h-4 w-4" />
        Start Session
      </button>
    </article>
  );
}

