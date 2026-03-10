import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { mustServerEnv } from "./server-env";

export class AuthError extends Error {
  constructor(message: "UNAUTHENTICATED" | "INVALID_TOKEN") {
    super(message);
    this.name = "AuthError";
  }
}

const COOKIE_NAME = "id_token";

type AuthConfig = {
  issuer: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
  clientId: string;
};

let cachedAuthConfigPromise: Promise<AuthConfig> | null = null;

async function getAuthConfig(): Promise<AuthConfig> {
  if (cachedAuthConfigPromise) return cachedAuthConfigPromise;

  cachedAuthConfigPromise = (async () => {
    const region = await mustServerEnv("COGNITO_REGION");
    const userPoolId = await mustServerEnv("COGNITO_USER_POOL_ID");
    const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    return { issuer, jwks, clientId };
  })();

  return cachedAuthConfigPromise;
}

export type AuthedUser = {
  sub: string;
  email?: string;
};

export async function requireUser(): Promise<AuthedUser> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) throw new AuthError("UNAUTHENTICATED");

  const { issuer, jwks, clientId } = await getAuthConfig();

  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer, audience: clientId }));
  } catch {
    throw new AuthError("INVALID_TOKEN");
  }

  const p = payload as Record<string, unknown>;

  const sub = p.sub;
  if (!sub || typeof sub !== "string") throw new AuthError("INVALID_TOKEN");

  const email = typeof p.email === "string" ? p.email : undefined;
  return { sub, email };
}
