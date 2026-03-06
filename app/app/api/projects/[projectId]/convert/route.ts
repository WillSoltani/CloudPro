import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

import { ddbDoc, TABLE_NAME, mustEnv } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

type OutputFormat = "PNG" | "JPG" | "WebP" | "GIF" | "TIFF" | "AVIF" | "DOCX" | "PDF";
type FileKind = "raw" | "output";

// Allowlist: source MIME prefix or extension keyword → permitted output formats.
// Enforced server-side even if the UI is bypassed.
const ALLOWED_OUTPUTS: Record<string, OutputFormat[]> = {
  "image/png":           ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  "image/jpeg":          ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  "image/webp":          ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  "image/gif":           ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  "image/tiff":          ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  "image/avif":          ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  "image/heic":          ["PNG", "JPG", "WebP", "AVIF"],
  "image/heif":          ["PNG", "JPG", "WebP", "AVIF"],
  "image/bmp":           ["PNG", "JPG", "WebP", "TIFF", "AVIF"],
  "image/x-bmp":         ["PNG", "JPG", "WebP", "TIFF", "AVIF"],
  "image/svg+xml":       ["PNG", "JPG", "WebP"],
  "image/x-icon":        ["PNG", "JPG", "WebP"],
  "image/vnd.microsoft.icon": ["PNG", "JPG", "WebP"],
  "application/pdf":     ["PNG", "JPG", "WebP", "DOCX"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["PNG", "JPG", "WebP", "PDF"],
  "application/msword":  ["PNG", "JPG", "WebP", "PDF"],
};

// Fallback: any image/* not listed above allows all outputs
function allowedOutputFormats(contentType: string): OutputFormat[] {
  const ct = (contentType || "").toLowerCase().split(";")[0].trim();
  if (ALLOWED_OUTPUTS[ct]) return ALLOWED_OUTPUTS[ct];
  if (ct.startsWith("image/")) return ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"];
  return []; // non-image/document types: reject
}

type ConversionJobInput = {
  fileId: string;
  outputFormat: OutputFormat;
  quality: number | null;
  preset: string | null;
  resizePct: number | null;
};

type ConvertBody = {
  conversions?: unknown[];
};

type ProjectLookup = { status: string };

type DbFileItem = {
  PK: string; SK: string; entity: "FILE"; kind: FileKind;
  fileId: string; projectId: string; userSub: string;
  filename: string; contentType: string; sizeBytes: number | null;
  bucket: string; key: string; status: string; createdAt: string; updatedAt: string;
};

type ConvertResult =
  | { fileId: string; ok: true; outputFileId: string }
  | { fileId: string; ok: false; error: string };

function nowIso() { return new Date().toISOString(); }

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string { return typeof v === "string" ? v : ""; }

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "unknown error"; }
}

function parseOutputFormat(v: unknown): OutputFormat | null {
  if (typeof v !== "string") return null;
  const up = v.trim();
  const allowed: OutputFormat[] = ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF", "DOCX", "PDF"];
  return allowed.includes(up as OutputFormat) ? (up as OutputFormat) : null;
}

function normalizeKind(v: unknown): FileKind { return v === "output" ? "output" : "raw"; }

function toDbFileItem(raw: unknown): DbFileItem | null {
  if (!isRecord(raw)) return null;
  const PK = str(raw.PK); const SK = str(raw.SK);
  const fileId = str(raw.fileId); const projectId = str(raw.projectId);
  const userSub = str(raw.userSub); const filename = str(raw.filename);
  const bucket = str(raw.bucket); const key = str(raw.key);
  if (!PK || !SK || !fileId || !projectId || !userSub || !filename || !bucket || !key) return null;
  const createdAt = str(raw.createdAt) || nowIso();
  return {
    PK, SK, entity: "FILE", kind: normalizeKind(raw.kind),
    fileId, projectId, userSub, filename,
    contentType: str(raw.contentType) || "application/octet-stream",
    sizeBytes: numOrNull(raw.sizeBytes), bucket, key,
    status: str(raw.status) || "queued",
    createdAt, updatedAt: str(raw.updatedAt) || createdAt,
  };
}

async function fetchProjectById(userSub: string, projectId: string): Promise<ProjectLookup | null> {
  const PK = `USER#${userSub}`;
  let lastKey: Record<string, unknown> | undefined;
  for (let page = 0; page < 50; page += 1) {
    const res = await ddbDoc.send(new QueryCommand({
      TableName: TABLE_NAME, ConsistentRead: true,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": PK, ":prefix": "PROJECT#", ":pid": projectId },
      FilterExpression: "projectId = :pid",
      ProjectionExpression: "projectId, #s",
      ExpressionAttributeNames: { "#s": "status" },
      ExclusiveStartKey: lastKey as never, Limit: 50,
    }));
    for (const it of res.Items ?? []) {
      if (!isRecord(it)) continue;
      if (str(it.projectId) !== projectId) continue;
      return { status: str(it.status) || "active" };
    }
    if (!res.LastEvaluatedKey) return null;
    lastKey = res.LastEvaluatedKey as unknown as Record<string, unknown>;
  }
  return null;
}

function isRawConvertibleStatus(status: string): boolean {
  const v = (status || "").toLowerCase();
  return v === "queued" || v === "done";
}

function extForFormat(fmt: OutputFormat): string {
  const map: Record<OutputFormat, string> = { PNG: "png", JPG: "jpg", WebP: "webp", GIF: "gif", TIFF: "tiff", AVIF: "avif", DOCX: "docx", PDF: "pdf" };
  return map[fmt];
}

function replaceExt(filename: string, ext: string): string {
  const dot = filename.lastIndexOf(".");
  return (dot < 0 ? filename : filename.slice(0, dot)) + "." + ext;
}

function safeExecutionName(projectId: string, outFileId: string): string {
  return `p-${projectId}-o-${outFileId}`.replace(/[^0-9A-Za-z-_]/g, "_").slice(0, 80);
}

function parseConversionJob(raw: unknown): ConversionJobInput | null {
  if (!isRecord(raw)) return null;
  const fileId = str(raw.fileId);
  if (!fileId.trim()) return null;
  const outputFormat = parseOutputFormat(raw.outputFormat);
  if (!outputFormat) return null;
  const quality =
    typeof raw.quality === "number" && Number.isFinite(raw.quality)
      ? Math.max(1, Math.min(100, Math.floor(raw.quality))) : null;
  const preset = typeof raw.preset === "string" ? raw.preset.slice(0, 40) : null;
  const resizePct =
    typeof raw.resizePct === "number" && Number.isFinite(raw.resizePct)
      ? Math.max(10, Math.min(100, Math.floor(raw.resizePct))) : null;
  return { fileId: fileId.trim(), outputFormat, quality, preset, resizePct };
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser();
    const { projectId } = await params;
    if (!projectId) return jsonError(400, "bad_request", "projectId is required");

    const project = await fetchProjectById(user.sub, projectId);
    if (!project) return jsonError(404, "not_found", "project not found");
    if ((project.status || "active") !== "active") return jsonError(410, "gone", "project is not active");

    let body: ConvertBody = {};
    try { body = (await req.json()) as ConvertBody; } catch { return jsonError(400, "bad_request", "invalid json"); }

    if (!Array.isArray(body.conversions) || body.conversions.length === 0)
      return jsonError(400, "bad_request", "conversions must be a non-empty array");
    if (body.conversions.length > 25)
      return jsonError(400, "bad_request", "too many conversions (max 25)");

    const jobs = body.conversions.map(parseConversionJob).filter((j): j is ConversionJobInput => j !== null);
    if (jobs.length === 0) return jsonError(400, "bad_request", "no valid conversion jobs");

    // Deduplicate by fileId (keep last)
    const seen = new Map<string, ConversionJobInput>();
    for (const j of jobs) seen.set(j.fileId, j);

    const stateMachineArn = mustEnv("CONVERT_SFN_ARN");
    const outputBucketName = mustEnv("OUTPUT_BUCKET");
    const sfn = new SFNClient({});
    const PK = `USER#${user.sub}`;
    const results: ConvertResult[] = [];

    for (const [, job] of seen) {
      const { fileId, outputFormat, quality, preset, resizePct } = job;
      const rawSK = `FILE#${projectId}#${fileId}`;

      const got = await ddbDoc.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK: rawSK } }));
      const src = toDbFileItem(got.Item);
      if (!src) { results.push({ fileId, ok: false, error: "not found" }); continue; }
      if (src.projectId !== projectId || src.userSub !== user.sub) { results.push({ fileId, ok: false, error: "forbidden" }); continue; }
      if (src.kind !== "raw") { results.push({ fileId, ok: false, error: "cannot convert an output file" }); continue; }
      if (!isRawConvertibleStatus(src.status)) { results.push({ fileId, ok: false, error: `not convertible in status ${src.status}` }); continue; }
      if (!allowedOutputFormats(src.contentType).includes(outputFormat)) {
        results.push({ fileId, ok: false, error: `unsupported conversion: ${src.contentType} cannot be converted to ${outputFormat}` });
        continue;
      }

      const outFileId = crypto.randomUUID();
      const outSK = `FILE#${projectId}#${outFileId}`;
      const createdAt = nowIso();
      const outputFilename = replaceExt(src.filename, extForFormat(outputFormat));
      const outputKey = `private/${user.sub}/${projectId}/output/${outFileId}/${outputFilename}`;

      const outItem = {
        PK, SK: outSK, entity: "FILE" as const, kind: "output" as const,
        fileId: outFileId, projectId, userSub: user.sub,
        filename: outputFilename, contentType: src.contentType,
        sizeBytes: null as number | null,
        bucket: outputBucketName, key: outputKey,
        status: "processing", createdAt, updatedAt: createdAt,
        sourceFileId: fileId, sourceContentType: src.contentType, outputFormat, quality, preset, resizePct,
      };

      try {
        await ddbDoc.send(new PutCommand({
          TableName: TABLE_NAME, Item: outItem,
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        }));
      } catch (e: unknown) {
        results.push({ fileId, ok: false, error: `ddb put failed: ${getErrorMessage(e)}` });
        continue;
      }

      try {
        await sfn.send(new StartExecutionCommand({
          stateMachineArn,
          name: safeExecutionName(projectId, outFileId),
          input: JSON.stringify({ userSub: user.sub, projectId, sourceFileId: fileId, outputFileId: outFileId, outputFormat, quality, preset, resizePct }),
        }));
      } catch (e: unknown) {
        const msg = getErrorMessage(e);
        try {
          await ddbDoc.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: { ...outItem, status: "failed", updatedAt: nowIso(), errorMessage: msg },
          }));
        } catch { /* ignore */ }
        results.push({ fileId, ok: false, error: `enqueue failed: ${msg}` });
        continue;
      }

      results.push({ fileId, ok: true, outputFileId: outFileId });
    }

    return NextResponse.json({ ok: true, projectId, results }, { status: 200 });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN")
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    console.error("POST convert error:", e);
    return jsonError(500, "server_error", msg);
  }
}
