import { NextRequest, NextResponse } from "next/server";
import { getServerEnv, mustServerEnv } from "@/app/app/api/_lib/server-env";
import {
  authCallbackUriFromOrigin,
  isLocalOrigin,
  resolvePublicOrigin,
} from "@/app/app/_lib/server-origin";

function base64UrlEncode(bytes: Uint8Array) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = Buffer.from(str, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomBase64Url(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function resolveLoginRedirectUri(req: NextRequest, configured: string | undefined): string {
  const origin = resolvePublicOrigin({
    hostHeader: req.headers.get("host"),
    forwardedHostHeader: req.headers.get("x-forwarded-host"),
    forwardedProtoHeader: req.headers.get("x-forwarded-proto"),
    fallbackOrigin: new URL(req.url).origin,
  });

  const localCallbackUri = authCallbackUriFromOrigin(origin);
  const useLocalhostUri = process.env.NODE_ENV !== "production" && isLocalOrigin(origin);

  if (useLocalhostUri) return localCallbackUri;
  if (configured) return configured;
  if (isLocalOrigin(origin)) return localCallbackUri;

  throw new Error("Missing env var: COGNITO_REDIRECT_URI");
}

export async function GET(req: NextRequest) {
  const domain = (await mustServerEnv("COGNITO_DOMAIN")).replace(/\/$/, "");
  const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
  const configuredRedirectUri = await getServerEnv("COGNITO_REDIRECT_URI");
  const redirectUri = resolveLoginRedirectUri(req, configuredRedirectUri);

  if (!domain || !clientId || !redirectUri) {
    return new NextResponse("Missing server env vars", { status: 500 });
  }

  const state = crypto.randomUUID();
  const isProd = process.env.NODE_ENV === "production";

  // PKCE: verifier stored in an httpOnly cookie so JS can't steal them
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const url =
    `${domain}/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256`;

  const res = NextResponse.redirect(url);

  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 10 * 60,
  });

  res.cookies.set("pkce_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 10 * 60,
  });

  res.cookies.set("oauth_redirect_uri", redirectUri, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 10 * 60,
  });

  return res;
}
