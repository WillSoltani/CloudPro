import { NextRequest, NextResponse } from "next/server";
import { getServerEnv, mustServerEnv } from "@/app/app/api/_lib/server-env";
import {
  authCallbackUriFromOrigin,
  isLocalOrigin,
  resolvePublicOrigin,
} from "@/app/app/_lib/server-origin";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resolveCallbackRedirectUri(params: {
  origin: string;
  cookieRedirectUri: string | null;
  configuredRedirectUri: string | undefined;
}): string {
  const localCallbackUri = authCallbackUriFromOrigin(params.origin);
  const allowLocalFallback =
    process.env.NODE_ENV !== "production" && isLocalOrigin(params.origin);

  if (params.cookieRedirectUri) {
    if (
      params.configuredRedirectUri &&
      params.cookieRedirectUri === params.configuredRedirectUri
    ) {
      return params.cookieRedirectUri;
    }
    if (allowLocalFallback && params.cookieRedirectUri === localCallbackUri) {
      return params.cookieRedirectUri;
    }
  }

  if (allowLocalFallback) return localCallbackUri;
  if (params.configuredRedirectUri) return params.configuredRedirectUri;
  throw new Error("Missing env var: COGNITO_REDIRECT_URI");
}

export async function GET(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const origin = resolvePublicOrigin({
    hostHeader: req.headers.get("host"),
    forwardedHostHeader: req.headers.get("x-forwarded-host"),
    forwardedProtoHeader: req.headers.get("x-forwarded-proto"),
    fallbackOrigin: new URL(req.url).origin,
  });
  try {
    const domain = (await mustServerEnv("COGNITO_DOMAIN")).replace(/\/$/, "");
    const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
    const configuredRedirectUri = await getServerEnv("COGNITO_REDIRECT_URI");
    const cookieRedirectUri = readString(req.cookies.get("oauth_redirect_uri")?.value);
    const redirectUri = resolveCallbackRedirectUri({
      origin,
      cookieRedirectUri,
      configuredRedirectUri,
    });

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?auth=error", origin));
    }

    const verifier = req.cookies.get("pkce_verifier")?.value;
    const expectedState = req.cookies.get("oauth_state")?.value;

    if (!verifier || state !== expectedState) {
      return NextResponse.redirect(new URL("/?auth=state_error", origin));
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
      cache: "no-store",
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/?auth=token_error", origin));
    }

    const tokens = (await tokenRes.json()) as Record<string, unknown>;
    const idToken = readString(tokens.id_token);
    const accessToken = readString(tokens.access_token);

    if (!idToken || !accessToken) {
      return NextResponse.redirect(new URL("/?auth=token_error", origin));
    }

    const res = NextResponse.redirect(new URL("/app", origin));

    const commonCookie = {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/",
      maxAge: Number(tokens.expires_in) || 3600,
    };

    res.cookies.set("id_token", idToken, commonCookie);
    res.cookies.set("access_token", accessToken, commonCookie);

    // Clear PKCE cookies (more reliable than delete across Next versions)
    res.cookies.set("pkce_verifier", "", { path: "/", maxAge: 0 });
    res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
    res.cookies.set("oauth_redirect_uri", "", { path: "/", maxAge: 0 });

    return res;
  } catch (error: unknown) {
    console.error("auth_callback_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/?auth=server_error", origin));
  }
}
