import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const COOKIE_NAME = "id_token";

const region = mustEnv("COGNITO_REGION");
const userPoolId = mustEnv("COGNITO_USER_POOL_ID");

// Cognito issuer + JWKS endpoint
const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

export type AuthedUser = {
  sub: string;
  email?: string;
};

export async function requireUser(): Promise<AuthedUser> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) throw new Error("UNAUTHENTICATED");

  const { payload } = await jwtVerify(token, jwks, { issuer });

  const sub = payload.sub;
  if (!sub || typeof sub !== "string") throw new Error("INVALID_TOKEN");

  const email =
    typeof payload.email === "string" ? payload.email : undefined;

  return { sub, email };
}
