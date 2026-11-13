/**
 * The page the gate script opens: `base` + "/" and, when `query` is not empty, "?" + query. A leading "?" or "&" in
 * `query` is tolerated, so `--query "?loader=legacy"` works too.
 */
export function pageUrl(base, query) {
  const q = String(query ?? "").replace(/^[?&]+/, "");
  return `${base}/${q ? `?${q}` : ""}`;
}
