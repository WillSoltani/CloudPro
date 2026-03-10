import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { resolveCognitoDomain } from "../_lib/cognito-domain";

export async function GET() {
  const domain = await resolveCognitoDomain();
  const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
  const logoutRedirect = await mustServerEnv("COGNITO_LOGOUT_REDIRECT_URI");

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
