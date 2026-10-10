"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * A budget for the section textures' WebGL contexts: at most MAX halftones are mounted at once.
 * Sections ask for a slot while they are near the viewport; the ones whose header box is closest
 * to the viewport centre hold the slots, re-ranked on scroll. (About, Certifications and Skills are
 * short enough that all three headers can sit inside one viewport plus margin, so an observer
 * alone cannot cap the count.)
 */
const MAX = 2;

/** Registered header boxes → whether their section currently wants a slot. */
const wants = new Map<HTMLElement, boolean>();
const granted = new Set<HTMLElement>();
const listeners = new Set<() => void>();
let raf = 0;
let listening = false;

function distance(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2);
}

function rank() {
  raf = 0;
  const next = [...wants]
    .filter(([, wanted]) => wanted)
    .map(([el]) => el)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, MAX);
  if (next.length === granted.size && next.every((el) => granted.has(el))) return;
  granted.clear();
  for (const el of next) granted.add(el);
  for (const notify of listeners) notify();
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(rank);
}

function listen(on: boolean) {
  if (on === listening) return;
  listening = on;
  if (on) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  } else {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  }
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** True while `el` holds one of the slots. `wanted` is the caller's own "near the viewport" signal. */
export function useVeilSlot(el: HTMLElement | null, wanted: boolean): boolean {
  useEffect(() => {
    if (!el) return;
    wants.set(el, wanted);
    listen(true);
    schedule();
    return () => {
      wants.delete(el);
      if (wants.size === 0) listen(false);
      schedule();
    };
  }, [el, wanted]);

  return useSyncExternalStore(subscribe, () => el !== null && granted.has(el), () => false);
}
