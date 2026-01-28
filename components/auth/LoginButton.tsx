"use client";

export function LoginButton() {
  const login = async () => {
    const domainRaw = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI;

    if (!domainRaw || !clientId || !redirectUri) {
      console.error("Missing Cognito env vars.");
      return;
    }

    // Ensure domain includes protocol and has no trailing slash
    const domain = domainRaw.startsWith("http")
      ? domainRaw.replace(/\/$/, "")
      : `https://${domainRaw.replace(/\/$/, "")}`;

    const scope = "openid email profile";
    const state = crypto.randomUUID();

    // PKCE
    const codeVerifier = base64UrlRandom(32);
    const codeChallenge = await sha256Base64Url(codeVerifier);

    sessionStorage.setItem("pkce_verifier", codeVerifier);
    sessionStorage.setItem("oauth_state", state);

    const url =
      `${domain}/oauth2/authorize` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256`;

    // Optional: for your UI hook pattern
    window.dispatchEvent(new Event("auth:changed"));

    window.location.assign(url);
  };

  return (
    <button
      type="button"
      onClick={login}
      className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15"
    >
      Log in
    </button>
  );
}

function base64UrlRandom(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
