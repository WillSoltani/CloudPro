import { NextRequest, NextResponse } from "next/server";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(req: NextRequest) {
  const domain = mustEnv("COGNITO_DOMAIN").replace(/\/$/, "");
  const clientId = mustEnv("COGNITO_CLIENT_ID");
  const redirectUri = mustEnv("COGNITO_REDIRECT_URI");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?auth=error", req.url));
  }

  const verifier = req.cookies.get("pkce_verifier")?.value;
  const expectedState = req.cookies.get("oauth_state")?.value;

  if (!verifier || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth=state_error", req.url));
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const tokenRes = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?auth=token_error", req.url));
  }

  const tokens = await tokenRes.json();

  const res = NextResponse.redirect(new URL("/app", req.url));

  // Store tokens securely
  res.cookies.set("id_token", tokens.id_token, {
    httpOnly: true,
    secure: false, // true in prod
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expires_in,
  });

  res.cookies.set("access_token", tokens.access_token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expires_in,
  });

  // Cleanup PKCE cookies
  res.cookies.delete("pkce_verifier");
  res.cookies.delete("oauth_state");

  return res;
}
