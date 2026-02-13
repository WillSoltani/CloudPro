"use client";

export function IconButton(props: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
        props.danger
          ? "border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15 disabled:opacity-50"
          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-50",
      ].join(" ")}
      aria-label={props.label}
      title={props.label}
    >
      {props.icon}
      {props.label}
    </button>
  );
}
