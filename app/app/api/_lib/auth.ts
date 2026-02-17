// app/app/api/_lib/auth.ts
import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";

export class AuthError extends Error {
  constructor(message: "UNAUTHENTICATED" | "INVALID_TOKEN") {
    super(message);
    this.name = "AuthError";
  }
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const COOKIE_NAME = "id_token";

const region = mustEnv("COGNITO_REGION");
const userPoolId = mustEnv("COGNITO_USER_POOL_ID");

const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

export type AuthedUser = {
  sub: string;
  email?: string;
};

export async function requireUser(): Promise<AuthedUser> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) throw new AuthError("UNAUTHENTICATED");

  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer }));
  } catch {
    throw new AuthError("INVALID_TOKEN");
  }

  const p = payload as Record<string, unknown>;

  const sub = p.sub;
  if (!sub || typeof sub !== "string") throw new AuthError("INVALID_TOKEN");

  const email = typeof p.email === "string" ? p.email : undefined;
  return { sub, email };
}
