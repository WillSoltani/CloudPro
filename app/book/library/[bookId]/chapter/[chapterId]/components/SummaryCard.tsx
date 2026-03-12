"use client";

type SummaryCardProps = {
  bullets: string[];
  takeaways: string[];
  keyQuote?: string;
  recap?: string;
  showRecap: boolean;
  onToggleRecap: () => void;
  onSaveTakeaways: () => void;
  fontScaleClass: string;
};

export function SummaryCard({
  bullets,
  takeaways,
  keyQuote,
  recap,
  showRecap,
  onToggleRecap,
  onSaveTakeaways,
  fontScaleClass,
}: SummaryCardProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-6 shadow-[0_20px_50px_rgba(2,6,23,0.5)] sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-3xl font-semibold uppercase tracking-[0.12em] text-slate-200">
            Chapter Summary
          </h2>
          <button
            type="button"
            onClick={onSaveTakeaways}
            className="rounded-xl border border-sky-300/35 bg-sky-500/12 px-3 py-1.5 text-sm font-medium text-sky-100 transition hover:bg-sky-500/18"
          >
            Save takeaways
          </button>
        </div>

        <ul className="space-y-3">
          {bullets.map((bullet) => (
            <li key={bullet} className={["flex gap-3 text-slate-200", fontScaleClass].join(" ")}>
              <span className="mt-[0.52rem] inline-flex h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px] bg-sky-300/90" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </section>

      {keyQuote ? (
        <section className="rounded-2xl border border-sky-300/20 bg-sky-500/8 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-sky-200">Key quote</p>
          <p className={["mt-2 text-slate-100", fontScaleClass].join(" ")}>{`“${keyQuote}”`}</p>
        </section>
      ) : null}

      {recap ? (
        <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
          <button
            type="button"
            onClick={onToggleRecap}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              1-minute recap
            </span>
            <span className="text-sm text-slate-300">{showRecap ? "Hide" : "Show"}</span>
          </button>
          {showRecap ? (
            <p className={["mt-3 text-slate-200", fontScaleClass].join(" ")}>{recap}</p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Key takeaways
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {takeaways.map((takeaway) => (
            <span
              key={takeaway}
              className="rounded-full border border-sky-300/35 bg-sky-500/12 px-3 py-1 text-sm font-medium text-sky-100"
            >
              {takeaway}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
