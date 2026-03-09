import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

type ProxyAuthConfig = {
  issuer: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
};

let cachedProxyAuthConfig: ProxyAuthConfig | null = null;
let missingProxyConfigWarned = false;

function getProxyAuthConfig(): ProxyAuthConfig | null {
  if (cachedProxyAuthConfig) return cachedProxyAuthConfig;

  const region = process.env.COGNITO_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!region || !userPoolId) {
    return null;
  }

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  const jwks = createRemoteJWKSet(
    new URL(`${issuer}/.well-known/jwks.json`)
  );

  cachedProxyAuthConfig = { issuer, jwks };
  return cachedProxyAuthConfig;
}

async function isValidToken(token: string, config: ProxyAuthConfig): Promise<boolean> {
  try {
    await jwtVerify(token, config.jwks, { issuer: config.issuer });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const authConfig = getProxyAuthConfig();
  if (!authConfig) {
    if (!missingProxyConfigWarned) {
      missingProxyConfigWarned = true;
      console.warn(
        "proxy_auth_config_missing: COGNITO_REGION/COGNITO_USER_POOL_ID not set in runtime env; skipping proxy auth check"
      );
    }
    return NextResponse.next();
  }

  const token = req.cookies.get("id_token")?.value;

  if (!token || !(await isValidToken(token, authConfig))) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");

    const res = NextResponse.redirect(url);

    res.cookies.delete("id_token");

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
