/**
 * Caption typography for the hero's captions (BeaconCaptions), per films-src/beacon/storyboard.md §3.
 *
 * Phone (default): a full-width block in the bottom third, over the scrim, clear of the lamp.
 * Desktop (`wide:`): the quiet left quarter of the frame, vertically centred, x 5–30 %.
 */
export const CAPTION_COLUMN = [
  "absolute inset-x-0 bottom-0 flex max-h-[36svh] flex-col justify-end px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))]",
  "wide:inset-x-auto wide:top-1/2 wide:bottom-auto wide:left-[5vw] wide:w-[25vw] wide:max-w-[34rem] wide:min-w-[20rem] wide:max-h-none wide:-translate-y-1/2 wide:justify-start wide:px-0 wide:pb-0",
].join(" ");

/** Geist Mono beat label; the text is set in uppercase by CSS. */
export const CAPTION_LABEL =
  "font-mono text-[11px] uppercase tracking-[0.22em] text-slate-200 wide:text-xs";

/** Fraunces line under the label. */
export const CAPTION_LINE =
  "mt-3 font-serif text-2xl leading-[1.12] text-pretty text-slate-50 wide:text-[clamp(1.75rem,2.1vw,2.5rem)]";

/** Mono supporting line; `CAPTION_SUPPORT` carries the first line's top margin. */
export const CAPTION_SUPPORT_BASE =
  "font-mono text-xs leading-relaxed text-pretty text-slate-200/90 wide:text-[13px]";
export const CAPTION_SUPPORT = `mt-3 ${CAPTION_SUPPORT_BASE}`;

/** `NN / LABEL`: the number lit in lamp, the slash in slate. */
export function CaptionLabel({ n, label }: { n: string; label: string }) {
  return (
    <p className={CAPTION_LABEL}>
      <span className="text-lamp">{n}</span> <span className="text-slate-500">/</span> {label}
    </p>
  );
}
