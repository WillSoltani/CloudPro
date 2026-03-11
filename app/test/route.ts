import { NextResponse, type NextRequest } from "next/server";
import {
  GUEST_PROJECT_ID,
  GUEST_SESSION_COOKIE,
  guestCookieOptions,
  newGuestSessionId,
  normalizeGuestSessionId,
} from "@/app/app/api/_lib/guest-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const existing = normalizeGuestSessionId(req.cookies.get(GUEST_SESSION_COOKIE)?.value ?? null);
  const sessionId = existing ?? newGuestSessionId();

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = `/app/projects/${GUEST_PROJECT_ID}`;
  redirectUrl.search = "";

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set(GUEST_SESSION_COOKIE, sessionId, guestCookieOptions());
  return res;
}

