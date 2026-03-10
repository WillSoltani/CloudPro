import { headers } from "next/headers";

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function resolvePublicOrigin(params: {
  hostHeader?: string | null;
  forwardedHostHeader?: string | null;
  forwardedProtoHeader?: string | null;
  fallbackOrigin?: string;
}): string {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  if (configuredBaseUrl) return normalizeOrigin(configuredBaseUrl);

  const forwardedHost = firstForwardedValue(params.forwardedHostHeader ?? null);
  const host = forwardedHost || params.hostHeader || null;
  const proto =
    firstForwardedValue(params.forwardedProtoHeader ?? null) ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) return normalizeOrigin(`${proto}://${host}`);
  if (params.fallbackOrigin) return normalizeOrigin(params.fallbackOrigin);

  if (process.env.NODE_ENV === "production") {
    throw new Error("Unable to resolve public origin. Set APP_BASE_URL for production.");
  }
  return "http://localhost:3000";
}

export async function getServerOrigin(): Promise<string> {
  const h = await headers();
  return resolvePublicOrigin({
    hostHeader: h.get("host"),
    forwardedHostHeader: h.get("x-forwarded-host"),
    forwardedProtoHeader: h.get("x-forwarded-proto"),
  });
}

