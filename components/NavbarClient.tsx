"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Github, LayoutDashboard, Linkedin, Menu, X } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { FOCUS_RING } from "@/components/focusRing";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { HERO_INTRO_END } from "@/components/film/heroBeats";
import { HERO_FILM_SELECTOR, useFilmInView } from "@/components/film/useFilmInView";
import { useReelChrome } from "@/components/film/useReelChrome";
import { social, type SocialId } from "@/content/social";

const links = [
  { id: "about", label: "About" },
  { id: "certifications", label: "Certifications" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
] as const;

const socialIcons: Record<SocialId, typeof Github> = { github: Github, linkedin: Linkedin };

const panelVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 + i * 0.05, duration: 0.2 },
  }),
};

type Props = { initialLoggedIn?: boolean };

export function NavbarClient({ initialLoggedIn }: Props) {
  // Probe the session only when the server saw the cookie: a signed-out visitor gets no request at all.
  const { loggedIn, loading } = useAuthStatus(initialLoggedIn === true);

  // Use SSR-provided value while the client-side fetch is still in flight,
  // then switch to the live hook result once it resolves.
  const showLoggedIn = loading
    ? (initialLoggedIn ?? false)
    : loggedIn === true;

  const [nearTop, setNearTop] = useState(true);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // `inView`: the hero extends below the header's bottom edge (the brand hides there).
  const film = useFilmInView("-80px 0px 0px 0px");
  // The reel clock (FilmBackdrop): `section` is the chapter whose unit has lit (the active pill, in step
  // with the film rather than a scroll-spy band).
  const { section } = useReelChrome();
  const active: string | null = section || null;

  const handleNavClick = () => {
    setOpen(false);
  };

  useEffect(() => {
    const onScroll = () => {
      const f = document.querySelector<HTMLElement>(HERO_FILM_SELECTOR);
      // The hero's opening caption is gone at the end of its intro window (heroBeats HERO_INTRO_END), so the
      // name returns there (a fixed half screen would leave it missing for a few hundred px on the long
      // hero). On phones it waits for the whole hero: the data hall's ceiling panels would put it white on
      // white.
      const range = f ? f.offsetHeight - window.innerHeight : 0;
      const until = window.innerWidth < 768 ? 1 : HERO_INTRO_END;
      setNearTop(window.scrollY < (range > 0 ? until * range : 0.55 * window.innerHeight));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // The phone menu: Escape closes it and puts focus back on the toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  // Tabbing out of the panel (to anything but its toggle) closes it, so it never sits open behind focus.
  const onPanelBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next) && next !== toggleRef.current) setOpen(false);
  };
  // And from the toggle itself (Shift+Tab back past it while the panel is open).
  const onToggleBlur = (e: FocusEvent<HTMLButtonElement>) => {
    const next = e.relatedTarget as Node | null;
    if (open && next && !panelRef.current?.contains(next)) setOpen(false);
  };

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // The film's hero already says the name: hide the brand while its opening caption is on screen, i.e.
  // until the end of the hero's intro window (nearTop; half a screen if there is no hero). Before the
  // observer reports, assume the film (this navbar is homepage-only).
  const brandHidden = nearTop && (film.inView || !film.present);

  return (
    // The header stays clear at every scroll position (no fill, blur or hairline), so the reel reads as one
    // piece; the nav pill keeps its own 5 % fill.
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        {/* The current route: nothing to prefetch (it only produced aborted `/?_rsc=` requests). */}
        <Link
          href="/#about"
          prefetch={false}
          className={[
            "shrink-0 rounded-sm text-lg font-semibold transition-opacity duration-300",
            FOCUS_RING,
            brandHidden ? "pointer-events-none opacity-0" : "opacity-100",
          ].join(" ")}
          tabIndex={brandHidden ? -1 : undefined}
          aria-hidden={brandHidden || undefined}
        >
          <span className="bg-linear-to-b from-white to-slate-300 bg-clip-text text-transparent">
            Will Soltani
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <nav
            aria-label="Primary"
            className="relative hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm text-slate-300 md:flex"
          >
            {links.map((l) => {
              const isActive = active === l.id;
              return (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={handleNavClick}
                  aria-current={isActive ? "location" : undefined}
                  className={`relative rounded-full px-3 py-1.5 hover:text-slate-100 ${FOCUS_RING}`}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-white/10"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 40,
                      }}
                    />
                  ) : null}
                  <span className="relative">{l.label}</span>
                </a>
              );
            })}
            <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
            {social.map((s) => {
              const Icon = socialIcons[s.id];
              return (
                <a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${s.label} (opens in a new tab)`}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100 ${FOCUS_RING}`}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                </a>
              );
            })}
          </nav>

          {showLoggedIn ? (
            <Link
              href="/dashboard"
              className={`hidden md:inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-2 text-sm text-slate-100 shadow-[0_0_0_0_rgba(56,189,248,0.0)] transition hover:bg-white/15 hover:shadow-[0_0_28px_rgba(56,189,248,0.22)] ${FOCUS_RING}`}
            >
              <LayoutDashboard className="h-4 w-4 text-sky-200" />
              Dashboard
            </Link>
          ) : null}
          {/* No "Log in" on the homepage (the live app is reached from its case study); Log out when signed in. */}
          {showLoggedIn ? (
            <div className="hidden md:block">
              <LogoutButton />
            </div>
          ) : null}

          <button
            ref={toggleRef}
            type="button"
            onBlur={onToggleBlur}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 md:hidden ${FOCUS_RING}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="md:hidden"
          >
            <div ref={panelRef} id="mobile-nav" className="px-4 pb-4 sm:px-6" onBlur={onPanelBlur}>
              <nav
                aria-label="Primary"
                className="rounded-2xl border border-white/10 bg-[#070b16]/80 p-2 backdrop-blur"
              >
                {showLoggedIn ? (
                  <motion.div
                    custom={-1}
                    variants={itemVariants}
                    initial="hidden"
                    animate="show"
                    className="px-2 pt-2"
                  >
                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 ${FOCUS_RING}`}
                    >
                      <span className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-sky-200" />
                        Dashboard
                      </span>
                      <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.35)]" />
                    </Link>
                  </motion.div>
                ) : null}

                {links.map((l, i) => {
                  const isActive = active === l.id;
                  return (
                    <motion.a
                      key={l.id}
                      href={`#${l.id}`}
                      custom={i}
                      variants={itemVariants}
                      initial="hidden"
                      animate="show"
                      aria-current={isActive ? "location" : undefined}
                      className={[
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm transition",
                        FOCUS_RING,
                        isActive
                          ? "bg-white/10 text-slate-100"
                          : "text-slate-300 hover:bg-white/10 hover:text-slate-100",
                      ].join(" ")}
                      onClick={handleNavClick}
                    >
                      <span>{l.label}</span>
                      {isActive ? (
                        <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.35)]" />
                      ) : null}
                    </motion.a>
                  );
                })}

                <div className="mt-2 border-t border-white/10 pt-2">
                  {social.map((s, i) => {
                    const Icon = socialIcons[s.id];
                    return (
                      <motion.a
                        key={s.id}
                        href={s.href}
                        target="_blank"
                        rel="noreferrer"
                        custom={links.length + i}
                        variants={itemVariants}
                        initial="hidden"
                        animate="show"
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-slate-100 ${FOCUS_RING}`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon aria-hidden className="h-4 w-4" />
                          {s.label}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </span>
                        <ExternalLink aria-hidden className="h-4 w-4 text-slate-500" />
                      </motion.a>
                    );
                  })}
                </div>

                {showLoggedIn ? (
                  <div className="mt-2 border-t border-white/10 px-2 pb-1 pt-2">
                    <LogoutButton />
                  </div>
                ) : null}
              </nav>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
