"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";


import { LoginButton } from "@/components/auth/LoginButton";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useAuth } from "@/components/auth/useAuth";

const links = [
  { id: "about", label: "About" },
  { id: "certifications", label: "Certifications" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "contact", label: "Contact" },
] as const;

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

export function Navbar() {
  const { loggedIn } = useAuth();

  const [active, setActive] = useState<string>("about");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const linkIds = useMemo(() => links.map((l) => l.id), []);

  const handleNavClick = (id: string) => {
    // Immediately show highlight on click (IntersectionObserver will keep it correct afterwards).
    setActive(id);
    setOpen(false);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight active section as you scroll
  useEffect(() => {
    const els = linkIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0)
          )[0];

        if (visible?.target?.id) setActive(visible.target.id);
      },
      // Less picky: helps short sections (Projects/Contact) trigger reliably.
      { threshold: 0.15, rootMargin: "-10% 0px -70% 0px" }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [linkIds]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-50 transition",
        scrolled
          ? "border-b border-white/10 bg-[#070b16]/70 backdrop-blur"
          : "border-b border-white/5 bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Logo */}
        <Link href="/#about" className="text-lg font-semibold">
          <span className="bg-linear-to-b from-white to-slate-300 bg-clip-text text-transparent">
            Will Soltani
          </span>
        </Link>


        {/* Right side: desktop nav + auth + mobile menu button */}
        <div className="flex items-center gap-3">
          {/* Desktop nav */}
          <nav className="relative hidden gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm text-slate-300 md:flex">
            {links.map((l) => {
              const isActive = active === l.id;
              return (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={() => handleNavClick(l.id)}
                  className="relative rounded-full px-3 py-1.5 hover:text-slate-100"
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
          </nav>

          {/* Auth (desktop) */}
          <div className="hidden md:block">
            {loggedIn ? <LogoutButton /> : <LoginButton />}
          </div>

          {/* Mobile button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      <AnimatePresence>
        {open ? (
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="md:hidden"
          >
            <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
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
                      className={[
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm transition",
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

                {/* Mobile auth */}
                <div className="mt-2 border-t border-white/10 pt-2 px-2 pb-1">
                  {loggedIn ? <LogoutButton /> : <LoginButton />}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
