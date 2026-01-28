"use client";

import { useCallback, useEffect, useState } from "react";

function readLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(sessionStorage.getItem("id_token"));
  } catch {
    return false;
  }
}

export function useAuth() {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => readLoggedIn());

  const sync = useCallback(() => {
    setLoggedIn(readLoggedIn());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Your custom event (you dispatch this after login/logout)
    window.addEventListener("auth:changed", sync);

    // Useful if you later move tokens to localStorage or have multi-tab scenarios
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("auth:changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  return { loggedIn, refresh: sync };
}
