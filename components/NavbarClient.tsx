"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Github, LayoutDashboard, Linkedin, Menu, X } from "lucide-react";
import Link from "next/link";

import { LoginButton } from "@/components/auth/LoginButton";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { HERO_FILM_SELECTOR, useFilmInView } from "@/components/film/useFilmInView";
import { social, type SocialId } from "@/content/social";

const links = [
  { id: "about", label: "About" },
  { id: "certifications", label: "Certifications" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "contact", label: "Contact" },
] as const;

const socialIcons: Record<SocialId, typeof Github> = { github: Github, linkedin: Linkedin };

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-night";

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
  const { loggedIn, loading } = useAuthStatus();

  // Use SSR-provided value while the client-side fetch is still in flight,
  // then switch to the live hook result once it resolves.
  const showLoggedIn = loading
    ? (initialLoggedIn ?? false)
    : loggedIn === true;

  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [nearTop, setNearTop] = useState(true);
  // The hero film's sticky stage has been released: the section's bottom edge is at or above the
  // viewport's, so the scene-4 caption and CTA are riding up under the header. (The chapter
  // dividers lower on the page are ordinary content as far as the header is concerned.)
  const [released, setReleased] = useState(false);
  const [open, setOpen] = useState(false);
  // In view while the film extends below the header's bottom edge.
  const film = useFilmInView("-80px 0px 0px 0px");

  const linkIds = useMemo(() => links.map((l) => l.id), []);

  const handleNavClick = (id: string) => {
    setActive(id);
    setOpen(false);
  };

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setNearTop(window.scrollY < 0.55 * window.innerHeight);
      const f = document.querySelector(HERO_FILM_SELECTOR);
      setReleased(!!f && f.getBoundingClientRect().bottom <= window.innerHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const els = linkIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (els.length === 0) return;

    // Scroll-spy band: the upper 10–30 % of the viewport. The section furthest down the page
    // that touches the band is current; none (over the film, between sections) clears the pill.
    const intersecting = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) intersecting.add(e.target.id);
          else intersecting.delete(e.target.id);
        }
        let current: string | null = null;
        for (const id of linkIds) if (intersecting.has(id)) current = id;
        setActive(current);
      },
      { threshold: 0, rootMargin: "-10% 0px -70% 0px" }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [linkIds]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Over the film the header stays glass-clear; the blurred bar begins as soon as the stage has
  // been released (the final caption scrolls up under the header), not only once the section has left.
  const blurred = scrolled && (!film.inView || released);
  // The film's hero already says the name: hide the brand until the viewer has scrolled past
  // half a screen. Before the observer reports, assume the film (this navbar is homepage-only).
  const brandHidden = nearTop && (film.inView || !film.present);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300",
        blurred
          ? "border-white/10 bg-[#070b16]/70 backdrop-blur"
          : "border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/#about"
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
                  onClick={() => handleNavClick(l.id)}
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
              className="hidden md:inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-2 text-sm text-slate-100 shadow-[0_0_0_0_rgba(56,189,248,0.0)] transition hover:bg-white/15 hover:shadow-[0_0_28px_rgba(56,189,248,0.22)]"
            >
              <LayoutDashboard className="h-4 w-4 text-sky-200" />
              Dashboard
            </Link>
          ) : null}
          <div className="hidden md:block">
            {showLoggedIn ? <LogoutButton /> : <LoginButton />}
          </div>

          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10 md:hidden ${FOCUS_RING}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
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
            <div className="px-4 pb-4 sm:px-6">
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
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
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
                      onClick={() => handleNavClick(l.id)}
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

                <div className="mt-2 border-t border-white/10 px-2 pb-1 pt-2">
                  {showLoggedIn ? <LogoutButton /> : <LoginButton />}
                </div>
              </nav>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
