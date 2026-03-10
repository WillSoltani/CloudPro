import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { mustServerEnv } from "../_lib/server-env";

type VerifierConfig = {
  issuer: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
  clientId: string;
};

let verifierConfigPromise: Promise<VerifierConfig> | null = null;

async function getVerifierConfig(): Promise<VerifierConfig> {
  if (verifierConfigPromise) return verifierConfigPromise;

  verifierConfigPromise = (async () => {
    const userPoolId = await mustServerEnv("COGNITO_USER_POOL_ID");
    const region = await mustServerEnv("COGNITO_REGION");
    const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    const jwks = createRemoteJWKSet(
      new URL(`${issuer}/.well-known/jwks.json`)
    );
    return { issuer, jwks, clientId };
  })();

  return verifierConfigPromise;
}

export async function GET() {
  const jar = await cookies();
  const token = jar.get("id_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const { issuer, jwks, clientId } = await getVerifierConfig();
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: clientId });

    return NextResponse.json({
      authenticated: true,
      user: {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
