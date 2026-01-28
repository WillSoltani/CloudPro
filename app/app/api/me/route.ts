// app/app/api/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const REGION = process.env.COGNITO_REGION!;

const JWKS = createRemoteJWKSet(
  new URL(
    `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`
  )
);

export async function GET() {
  const jar = await cookies();
  const token = jar.get("id_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
    });

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
