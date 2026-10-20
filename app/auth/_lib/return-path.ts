/**
 * The same-site half of sanitizeReturnTo (app/auth/_lib/return-to.ts), pure so it is unit-tested
 * (app/tests/return-to). A value with a control character is refused outright: the URL parser strips tab,
 * CR and LF, so "/\t/evil.com" would become "//evil.com", a protocol-relative URL to another site. Anything
 * else is resolved against a placeholder origin and kept only if it stays on that origin, as its path,
 * query and hash.
 */
const SAME_ORIGIN = "https://return-to.invalid";

export const hasControlChars = (raw: string) => /[\u0000-\u001f\u007f]/.test(raw);

export function sanitizeReturnPath(raw: string, fallback: string): string {
  if (!raw.startsWith("/") || hasControlChars(raw)) return fallback;
  try {
    const url = new URL(raw, SAME_ORIGIN);
    if (url.origin !== SAME_ORIGIN) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback;
  }
}
