import type { UiStatus } from "./types";

export function normalizeStatus(s: string): UiStatus {
  const v = (s || "").toLowerCase();
  if (v === "queued") return "queued";
  if (v === "processing") return "processing";
  if (v === "done" || v === "completed" || v === "complete") return "done";
  if (v === "failed" || v === "error") return "failed";
  return "unknown";
}

export function fmtBytes(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function extFromName(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function isLikelyImage(filename: string, contentType: string) {
  const ct = (contentType || "").toLowerCase();
  const ext = extFromName(filename);
  return (
    ct.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "tif", "tiff", "avif", "heic"].includes(ext)
  );
}
