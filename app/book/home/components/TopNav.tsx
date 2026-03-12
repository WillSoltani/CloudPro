"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { usePathname } from "next/navigation";
import { Menu, Settings, User, X } from "lucide-react";
import { SearchBox } from "@/app/book/home/components/SearchBox";
import { GlobalSearchPanel } from "@/app/book/home/components/GlobalSearchPanel";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";

export type BookNavTab = "home" | "library" | "progress" | "badges" | "settings";

type TopNavProps = {
  name: string;
  activeTab: BookNavTab;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: MutableRefObject<HTMLInputElement | null>;
  showSearch?: boolean;
  searchPlaceholder?: string;
  showGlobalSearchPanel?: boolean;
};

const navItems: Array<{ id: BookNavTab; label: string; href: string }> = [
  { id: "home", label: "Home", href: "/book/home" },
  { id: "library", label: "Library", href: "/book/library" },
  { id: "progress", label: "Progress", href: "/book/progress" },
  { id: "badges", label: "Badges", href: "/book/badges" },
];

export function TopNav({
  name,
  activeTab,
  searchQuery,
  onSearchChange,
  searchInputRef,
  showSearch = true,
  searchPlaceholder,
  showGlobalSearchPanel = true,
}: TopNavProps) {
  const pathname = usePathname();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);

  const initial = name.trim().charAt(0).toUpperCase() || "R";

  const focusSearchInput = () => {
    const preferMobile = window.matchMedia("(max-width: 767px)").matches;
    const target = preferMobile ? mobileSearchRef.current : desktopSearchRef.current;
    target?.focus();
    searchInputRef.current = target;
  };

  useKeyboardShortcut(
    "/",
    (event) => {
      if (!showSearch) return;
      event.preventDefault();
      focusSearchInput();
      setShowSearchPanel(true);
    },
    { ignoreWhenTyping: true }
  );

  useKeyboardShortcut("Escape", () => {
    setShowSearchPanel(false);
    setShowProfileMenu(false);
    setShowMobileMenu(false);
  });

  useEffect(() => {
    setShowSearchPanel(false);
    setShowProfileMenu(false);
    setShowMobileMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!showGlobalSearchPanel) return;
    if (!searchQuery.trim()) return;
    setShowSearchPanel(true);
  }, [searchQuery, showGlobalSearchPanel]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!headerRef.current) return;
      if (headerRef.current.contains(event.target as Node)) return;
      setShowSearchPanel(false);
      setShowProfileMenu(false);
    }

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#060a15]/80 backdrop-blur-xl">
      <div ref={headerRef} className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setShowMobileMenu((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-100 transition hover:bg-white/10"
              aria-label="Toggle navigation"
            >
              {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Book Accelerator
            </p>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => {
              const active = item.id === activeTab;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-sky-500/20 text-sky-100"
                      : "text-slate-300 hover:bg-white/7 hover:text-slate-100",
                  ].join(" ")}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {showSearch ? (
            <div className="relative hidden flex-1 justify-center px-2 md:flex">
              <SearchBox
                ref={desktopSearchRef}
                value={searchQuery}
                onChange={onSearchChange}
                onFocus={() => {
                  searchInputRef.current = desktopSearchRef.current;
                  setShowSearchPanel(true);
                }}
                placeholder={searchPlaceholder}
              />
              {showGlobalSearchPanel ? (
                <GlobalSearchPanel
                  open={showSearchPanel}
                  query={searchQuery}
                  onClose={() => setShowSearchPanel(false)}
                />
              ) : null}
            </div>
          ) : (
            <div className="hidden flex-1 md:block" />
          )}

          <div className="relative flex items-center gap-2">
            <Link
              href="/book/settings"
              className={[
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-slate-100",
                activeTab === "settings" ? "border-sky-300/40 bg-sky-500/16 text-sky-100" : "",
              ].join(" ")}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2.5 text-slate-200 transition hover:bg-white/10"
              aria-label="Profile"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-300 text-xs font-semibold text-slate-900">
                {initial}
              </span>
              <span className="hidden text-sm md:inline-flex">{name || "Reader"}</span>
            </button>

            {showProfileMenu ? (
              <div className="absolute right-0 top-12 w-52 rounded-2xl border border-white/15 bg-[#0b1020] p-2 shadow-[0_20px_45px_rgba(2,6,23,0.55)]">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/7"
                >
                  <User className="h-4 w-4" />
                  Profile (coming soon)
                </button>
                <Link
                  href="/dashboard"
                  className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/7"
                >
                  Back to tools
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {showSearch ? (
          <div className="relative mt-3 md:hidden">
            <SearchBox
              ref={mobileSearchRef}
              value={searchQuery}
              onChange={onSearchChange}
              onFocus={() => {
                searchInputRef.current = mobileSearchRef.current;
                setShowSearchPanel(true);
              }}
              placeholder={searchPlaceholder}
            />
            {showGlobalSearchPanel ? (
              <GlobalSearchPanel
                open={showSearchPanel}
                query={searchQuery}
                onClose={() => setShowSearchPanel(false)}
              />
            ) : null}
          </div>
        ) : null}

        {showMobileMenu ? (
          <div className="mt-3 grid gap-1 rounded-2xl border border-white/12 bg-white/[0.03] p-2 md:hidden">
            {navItems.map((item) => {
              const active = item.id === activeTab;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setShowMobileMenu(false)}
                  className={[
                    "rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-sky-500/20 text-sky-100"
                      : "text-slate-300 hover:bg-white/7 hover:text-slate-100",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </header>
  );
}
