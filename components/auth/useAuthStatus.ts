"use client";

import { useEffect, useState } from "react";

/**
 * The session probe. `enabled` false skips it (signed out): the server saw no id_token cookie, and the
 * probe of a signed-out visitor is redirected to Cognito by the middleware (a CORS error in the console).
 */
export function useAuthStatus(enabled = true) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(enabled ? null : false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/app/api/auth/session", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { loggedIn?: unknown };
        const v = data.loggedIn === true;
        if (!cancelled) setLoggedIn(v);
      } catch {
        if (!cancelled) setLoggedIn(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { loggedIn, loading: loggedIn === null };
}
