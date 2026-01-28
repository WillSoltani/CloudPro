"use client";

import { useEffect, useState } from "react";
import React from "react"


type TokenResponse = {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
};

function normalizeCognitoDomain(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Finishing sign-in...");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const domainRaw = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
      const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
      const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI;

      if (!domainRaw || !clientId || !redirectUri) {
        if (!cancelled) setMsg("Missing env vars for Cognito callback.");
        return;
      }

      const domain = normalizeCognitoDomain(domainRaw);

      const url = new URL(window.location.href);

      // Cognito can send back an error instead of code
      const oauthError = url.searchParams.get("error");
      const oauthErrorDesc = url.searchParams.get("error_description");
      if (oauthError) {
        if (!cancelled) {
          setMsg(`Login failed: ${oauthError}${oauthErrorDesc ? ` (${oauthErrorDesc})` : ""}`);
        }
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      const expectedState = sessionStorage.getItem("oauth_state");
      const verifier = sessionStorage.getItem("pkce_verifier");

      if (!code || !state || !expectedState || state !== expectedState || !verifier) {
        if (!cancelled) setMsg("Login failed: missing or invalid state/PKCE.");
        return;
      }

      const body = new URLSearchParams();
      body.set("grant_type", "authorization_code");
      body.set("client_id", clientId);
      body.set("code", code);
      body.set("redirect_uri", redirectUri);
      body.set("code_verifier", verifier);

      const res = await fetch(`${domain}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        if (!cancelled) setMsg(`Token exchange failed: ${res.status} ${text}`);
        return;
      }

      const tokens = (await res.json()) as TokenResponse;

      // DEV ONLY: sessionStorage
      sessionStorage.setItem("access_token", tokens.access_token);
      sessionStorage.setItem("id_token", tokens.id_token);
      if (tokens.refresh_token) sessionStorage.setItem("refresh_token", tokens.refresh_token);

      // Cleanup one-time values
      sessionStorage.removeItem("pkce_verifier");
      sessionStorage.removeItem("oauth_state");

      // Notify UI
      window.dispatchEvent(new Event("auth:changed"));

      if (!cancelled) setMsg("Signed in. Redirecting…");

      // Remove ?code=... from history + go back to site
      window.location.replace("/");
    };

    run().catch((e) => {
      if (!cancelled) setMsg(`Unexpected error: ${String(e)}`);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-slate-100">
      <h1 className="text-2xl font-semibold">Auth Callback</h1>
      <p className="mt-3 text-sm text-slate-300">{msg}</p>
    </main>
  );
}
