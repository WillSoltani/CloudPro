// app/app/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "id_token";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const loggedIn = cookieStore.has(COOKIE_NAME);

  if (!loggedIn) redirect("/");


  return (
    <div className="min-h-screen bg-[#070b16] text-slate-100">
      {/* App top bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b16]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-slate-300 hover:text-slate-100">
              ← Back
            </Link>
            <span className="text-sm text-slate-400">Secure Doc Processing</span>
          </div>

          <nav className="flex items-center gap-3">
            <Link href="/app" className="text-sm text-slate-300 hover:text-slate-100">
              Dashboard
            </Link>
            <Link
              href="/app/projects"
              className="text-sm text-slate-300 hover:text-slate-100"
            >
              Projects
            </Link>
            <Link
              href="/app/upload"
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/15"
            >
              Upload
            </Link>

            {/* Optional: app-side logout */}
            <a
              href="/auth/logout"
              className="text-sm text-slate-300 hover:text-slate-100"
            >
              Log out
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
