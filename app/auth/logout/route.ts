import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerEnv, mustServerEnv } from "@/app/app/api/_lib/server-env";
import {
  isLocalOrigin,
  logoutRedirectUriFromOrigin,
  resolvePublicOrigin,
} from "@/app/app/_lib/server-origin";

function resolveLogoutRedirectUri(req: NextRequest, configured: string | undefined): string {
  const origin = resolvePublicOrigin({
    hostHeader: req.headers.get("host"),
    forwardedHostHeader: req.headers.get("x-forwarded-host"),
    forwardedProtoHeader: req.headers.get("x-forwarded-proto"),
    fallbackOrigin: new URL(req.url).origin,
  });

  const localLogoutRedirect = logoutRedirectUriFromOrigin(origin);
  const useLocalhostUri = process.env.NODE_ENV !== "production" && isLocalOrigin(origin);

  if (useLocalhostUri) return localLogoutRedirect;
  if (configured) return configured;
  if (isLocalOrigin(origin)) return localLogoutRedirect;

  throw new Error("Missing env var: COGNITO_LOGOUT_REDIRECT_URI");
}

export async function GET(req: NextRequest) {
  const domain = await mustServerEnv("COGNITO_DOMAIN");
  const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
  const configuredLogoutRedirect = await getServerEnv("COGNITO_LOGOUT_REDIRECT_URI");
  const logoutRedirect = resolveLogoutRedirectUri(req, configuredLogoutRedirect);

  if (!domain || !clientId || !logoutRedirect) {
    return new NextResponse("Missing server env vars", { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.delete("id_token");
  cookieStore.delete("access_token");

  const logoutUrl =
    `${domain.replace(/\/$/, "")}/logout` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&logout_uri=${encodeURIComponent(logoutRedirect)}`;

  return NextResponse.redirect(logoutUrl);
}
