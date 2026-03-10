import { NextResponse } from "next/server";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { resolveCognitoDomain } from "../_lib/cognito-domain";

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

export async function GET() {
  const domain = await resolveCognitoDomain();
  const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
  const redirectUri = await mustServerEnv("COGNITO_REDIRECT_URI");

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

  return res;
}
