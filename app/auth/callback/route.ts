import { NextRequest, NextResponse } from "next/server";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

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
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?auth=token_error", req.url));
  }

  const tokens = await tokenRes.json();

  const res = NextResponse.redirect(new URL("/app", req.url));

  const commonCookie = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Number(tokens.expires_in) || 3600,
  };

  res.cookies.set("id_token", tokens.id_token, commonCookie);
  res.cookies.set("access_token", tokens.access_token, commonCookie);

  // Clear PKCE cookies (more reliable than delete across Next versions)
  res.cookies.set("pkce_verifier", "", { path: "/", maxAge: 0 });
  res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });

  return res;
}
