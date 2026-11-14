// How an in-page nav click scrolls (stage 8). Pure; the DOM side is components/AnchorJumps.tsx.
//
// app/globals.css sets `scroll-behavior: smooth` on <html>, so a click on a nav link (`#skills`, the hero's call to action,
// the skip link) used to scroll through every film in between: each one on screen for a moment, and the loader reading
// them. Where the target is more than one chapter away the page now jumps (the film already dissolves into the hold it
// lands on); one chapter away it keeps the smooth scroll. `?nav=smooth` keeps it smooth everywhere for one page load.

/**
 * The chapters in page order, with the two passages that have no nav link: the hero before About, and the exit and the
 * bridge (the epilogue) between Projects and Contact.
 */
export const NAV_ORDER = ["hero", "about", "certifications", "skills", "projects", "epilogue", "contact"] as const;

export type NavChapter = (typeof NAV_ORDER)[number];

/** A chapter a nav link can target: every one but the two passages. */
export function isNavTarget(id: string): boolean {
  return id !== "hero" && id !== "epilogue" && (NAV_ORDER as readonly string[]).includes(id);
}

/**
 * Where the page is: the chapter whose unit has lit (`<html data-reel-section>`), else the hero before About or the
 * epilogue after Projects (`pastProjects`: Projects' anchor is above the viewport's top).
 */
export function currentChapter(section: string, pastProjects: boolean): number {
  const i = (NAV_ORDER as readonly string[]).indexOf(section);
  if (i > 0 && isNavTarget(section)) return i;
  return pastProjects ? NAV_ORDER.indexOf("epilogue") : 0;
}

export type NavScroll = "instant" | "smooth";

/** `instant` when the target is more than one chapter from the current one, unless `?nav=smooth` asked for smooth. */
export function navScroll(from: number, to: number, smoothEverywhere: boolean): NavScroll {
  return !smoothEverywhere && Math.abs(to - from) > 1 ? "instant" : "smooth";
}

/** True when the query string asks for smooth scrolling everywhere. */
export function navSmoothRequested(search: string): boolean {
  return new URLSearchParams(search).get("nav") === "smooth";
}
