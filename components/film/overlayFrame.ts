// The page's overlay scheduler (overlayScheduler.ts) on framer-motion's frame loop, the one that ticks the film's
// smoothed clock. Client only in use; importing it on the server is harmless (nothing runs until a job is invalidated).
import { frame, frameData } from "framer-motion";
import { createOverlayScheduler, type OverlayCounters } from "@/components/film/overlayScheduler";

declare global {
  interface Window {
    /** The overlays' run counters (overlayScheduler.ts OverlayCounters). Measurement only: nothing reads them back. */
    __filmOverlay?: OverlayCounters;
  }
}

export const overlayFrame = createOverlayScheduler(
  {
    inFrame: () => frameData.isProcessing,
    beforeRender: (fn) => {
      frame.preRender(fn);
    },
    afterTask: (fn) => queueMicrotask(fn),
  },
  () => (typeof window === "undefined" ? undefined : (window.__filmOverlay ??= { flushes: 0, runs: {} })),
);
