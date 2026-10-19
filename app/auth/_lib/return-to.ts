import "server-only";

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const configured = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  for (const value of configured) {
    if (!value) continue;
    try {
      origins.add(normalizeOrigin(value));
    } catch {
      continue;
    }
  }

  return origins;
}

export function sanitizeReturnTo(
  value: string | null | undefined,
  fallback: string
): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  // A same-site path; "//host" and "/\\host" are protocol-relative URLs to another site, never paths.
  if (raw.startsWith("/")) {
    return raw.startsWith("//") || raw.startsWith("/\\") ? fallback : raw;
  }

  try {
    const target = new URL(raw);
    if (!allowedOrigins().has(target.origin)) {
      return fallback;
    }
    return normalizeUrl(target.toString());
  } catch {
    return fallback;
  }
}
