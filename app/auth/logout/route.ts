import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const domain = process.env.COGNITO_DOMAIN;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const logoutRedirect = process.env.COGNITO_LOGOUT_REDIRECT_URI;

  if (!domain || !clientId || !logoutRedirect) {
    return new NextResponse("Missing server env vars", { status: 500 });
  }

  // ✅ FIX: await cookies()
  const cookieStore = await cookies();
  cookieStore.delete("id_token");

  const logoutUrl =
    `${domain.replace(/\/$/, "")}/logout` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&logout_uri=${encodeURIComponent(logoutRedirect)}`;

  return NextResponse.redirect(logoutUrl);
}
