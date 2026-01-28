import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const REGION = process.env.COGNITO_REGION!;

const JWKS = createRemoteJWKSet(
  new URL(
    `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`
  )
);

export type AuthedUser = {
  sub: string;
  email?: string;
  name?: string;
};

export async function requireUser(): Promise<AuthedUser> {
  const jar = await cookies();
  const token = jar.get("id_token")?.value;
  if (!token) throw new Error("UNAUTHENTICATED");

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  });

  if (!payload.sub) throw new Error("UNAUTHENTICATED");

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}
