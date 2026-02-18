// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

const region = process.env.COGNITO_REGION!;
const userPoolId = process.env.COGNITO_USER_POOL_ID!;

const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
const jwks = createRemoteJWKSet(
  new URL(`${issuer}/.well-known/jwks.json`)
);

async function isValidToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, jwks, { issuer });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("id_token")?.value;

  if (!token || !(await isValidToken(token))) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");

    const res = NextResponse.redirect(url);

    // optional but recommended: clean bad cookie
    res.cookies.delete("id_token");

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
