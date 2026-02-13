import type { FileRow, UiStatus, CreateUploadResult, CompleteUploadResult } from "./types";

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
  const units = ["B", "KB", "MB", "GB", "TB"];
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
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext)
  );
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function pickObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

export function isFileRow(x: unknown): x is FileRow {
  const o = pickObject(x);
  if (!o) return false;
  return (
    typeof o.fileId === "string" &&
    typeof o.projectId === "string" &&
    typeof o.filename === "string" &&
    typeof o.contentType === "string" &&
    typeof o.status === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string" &&
    typeof o.bucket === "string" &&
    typeof o.key === "string"
  );
}

export function parseCreateUploadResponse(json: unknown): CreateUploadResult {
  const root = pickObject(json) ?? {};
  const upload = pickObject(root["upload"]) ?? {};

  const uploadId = pickString(
    root["uploadId"],
    upload["uploadId"],
    root["fileId"],
    upload["fileId"]
  );

  const putUrl = pickString(root["putUrl"], root["url"], upload["putUrl"], upload["url"]);
  const bucket = pickString(root["bucket"], upload["bucket"]);
  const key = pickString(root["key"], upload["key"]);

  const headersRaw =
    (pickObject(root["headers"]) ?? pickObject(upload["headers"]) ?? {}) as Record<
      string,
      unknown
    >;

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(headersRaw)) {
    if (typeof v === "string") headers[k] = v;
  }

  if (!uploadId || !putUrl || !bucket || !key) {
    throw new Error(
      `Create upload response missing fields. uploadId=${Boolean(uploadId)} putUrl=${Boolean(
        putUrl
      )} bucket=${Boolean(bucket)} key=${Boolean(key)}`
    );
  }

  return { uploadId, putUrl, bucket, key, method: "PUT", headers };
}

export function parseCompleteUploadResponse(json: unknown): CompleteUploadResult {
  const root = pickObject(json) ?? {};
  const file = root["file"];
  if (isFileRow(file)) return { file };
  return {};
}
