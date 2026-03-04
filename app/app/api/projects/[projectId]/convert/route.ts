import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { CopyObjectCommand } from "@aws-sdk/client-s3";

import { ddbDoc, TABLE_NAME, s3, mustEnv } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

type OutputFormat = "PNG" | "JPG" | "WebP" | "GIF" | "SVG" | "ICO" | "BMP" | "TIFF";
type FileKind = "raw" | "output";

type ConvertBody = {
  fileIds?: unknown;
  outputFormat?: unknown;
  quality?: unknown;
  preset?: unknown;
};

type ProjectLookup = { status: string };

type DbFileItem = {
  PK: string;
  SK: string;
  entity: "FILE";
  kind: FileKind;
  fileId: string;
  projectId: string;
  userSub: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  bucket: string;
  key: string;
  status: string;
  createdAt: string;
  updatedAt: string;

  // optional traceability
  sourceFileId?: string;
  outputFormat?: OutputFormat;
  quality?: number | null;
  preset?: string | null;
};

type ConvertResult =
  | { fileId: string; ok: true; outputFileId: string }
  | { fileId: string; ok: false; error: string };

function nowIso() {
  return new Date().toISOString();
}

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

function parseOutputFormat(v: unknown): OutputFormat | null {
  if (typeof v !== "string") return null;
  const up = v.trim();
  const allowed: OutputFormat[] = ["PNG", "JPG", "WebP", "GIF", "SVG", "ICO", "BMP", "TIFF"];
  return allowed.includes(up as OutputFormat) ? (up as OutputFormat) : null;
}

function normalizeKind(v: unknown): FileKind {
  return v === "output" ? "output" : "raw";
}

function toDbFileItem(raw: unknown): DbFileItem | null {
  if (!isRecord(raw)) return null;

  const PK = str(raw.PK);
  const SK = str(raw.SK);

  const fileId = str(raw.fileId);
  const projectId = str(raw.projectId);
  const userSub = str(raw.userSub);
  const filename = str(raw.filename);
  const bucket = str(raw.bucket);
  const key = str(raw.key);

  if (!PK || !SK || !fileId || !projectId || !userSub || !filename || !bucket || !key) return null;

  const createdAt = str(raw.createdAt) || nowIso();
  const updatedAt = str(raw.updatedAt) || createdAt;

  return {
    PK,
    SK,
    entity: "FILE",
    kind: normalizeKind(raw.kind),
    fileId,
    projectId,
    userSub,
    filename,
    contentType: str(raw.contentType) || "application/octet-stream",
    sizeBytes: numOrNull(raw.sizeBytes),
    bucket,
    key,
    status: str(raw.status) || "queued",
    createdAt,
    updatedAt,
  };
}

/**
 * Project lookup: query USER partition and filter by projectId (SK contains createdAt).
 * Paginate because FilterExpression + Limit is pre-filter.
 */
async function fetchProjectById(userSub: string, projectId: string): Promise<ProjectLookup | null> {
  const PK = `USER#${userSub}`;
  let lastKey: Record<string, unknown> | undefined;

  for (let page = 0; page < 50; page += 1) {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        ConsistentRead: true,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": PK,
          ":prefix": "PROJECT#",
          ":pid": projectId,
        },
        FilterExpression: "projectId = :pid",
        ProjectionExpression: "projectId, #s",
        ExpressionAttributeNames: { "#s": "status" },
        ExclusiveStartKey: lastKey as never,
        Limit: 50,
      })
    );

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

function encodeCopySourceKey(key: string): string {
  return key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function splitRawPrefix(key: string): { basePrefix: string } | null {
  const marker = "/raw/";
  const idx = key.indexOf(marker);
  if (idx === -1) return null;
  return { basePrefix: key.slice(0, idx) };
}

function stemFromFilename(name: string): string {
  const base = (name || "").split("?")[0].split("#")[0];
  const i = base.lastIndexOf(".");
  return i === -1 ? base : base.slice(0, i);
}

function outputExtForFormat(fmt: OutputFormat): string {
  if (fmt === "JPG") return "jpg";
  if (fmt === "WebP") return "webp";
  return fmt.toLowerCase();
}

function outputContentTypeForFormat(fmt: OutputFormat): string {
  switch (fmt) {
    case "PNG":
      return "image/png";
    case "JPG":
      return "image/jpeg";
    case "WebP":
      return "image/webp";
    case "GIF":
      return "image/gif";
    case "SVG":
      return "image/svg+xml";
    case "ICO":
      return "image/x-icon";
    case "BMP":
      return "image/bmp";
    case "TIFF":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

function isRawConvertibleStatus(status: string): boolean {
  const v = (status || "").toLowerCase();
  return v === "queued" || v === "done";
}

function dedupeFileIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
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
    try {
      body = (await req.json()) as ConvertBody;
    } catch {
      return jsonError(400, "bad_request", "invalid json");
    }

    if (!Array.isArray(body.fileIds)) return jsonError(400, "bad_request", "fileIds must be an array");

    const fileIds = dedupeFileIds(body.fileIds.filter((x): x is string => typeof x === "string"));
    if (fileIds.length === 0) return jsonError(400, "bad_request", "fileIds is empty");
    if (fileIds.length > 25) return jsonError(400, "bad_request", "too many fileIds (max 25)");

    const outputFormat = parseOutputFormat(body.outputFormat);
    if (!outputFormat) return jsonError(400, "bad_request", "invalid outputFormat");

    const quality =
      typeof body.quality === "number" && Number.isFinite(body.quality)
        ? Math.max(1, Math.min(100, Math.floor(body.quality)))
        : undefined;

    const preset = typeof body.preset === "string" ? body.preset.slice(0, 40) : undefined;

    const RAW_BUCKET = mustEnv("RAW_BUCKET");
    const OUTPUT_BUCKET = mustEnv("OUTPUT_BUCKET");

    const PK = `USER#${user.sub}`;
    const results: ConvertResult[] = [];

    for (const fileId of fileIds) {
      const SK = `FILE#${projectId}#${fileId}`;

      const got = await ddbDoc.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK } }));
      const srcItem = toDbFileItem(got.Item);

      if (!srcItem) {
        results.push({ fileId, ok: false, error: "not found" });
        continue;
      }

      if (srcItem.projectId !== projectId || srcItem.userSub !== user.sub) {
        results.push({ fileId, ok: false, error: "forbidden" });
        continue;
      }

      if (srcItem.kind !== "raw") {
        results.push({ fileId, ok: false, error: "cannot convert an output file" });
        continue;
      }

      if (!isRawConvertibleStatus(srcItem.status)) {
        results.push({ fileId, ok: false, error: `not convertible in status ${srcItem.status}` });
        continue;
      }

      const prefix = splitRawPrefix(srcItem.key);
      if (!prefix) {
        results.push({ fileId, ok: false, error: "invalid raw key shape (missing /raw/)" });
        continue;
      }

      const outFileId = crypto.randomUUID();
      const stem = stemFromFilename(srcItem.filename) || "file";
      const outExt = outputExtForFormat(outputFormat);
      const outName = `${stem}.${outExt}`;

      const outKey = `${prefix.basePrefix}/out/${outFileId}/${outName}`;

      // Copy = v1 “conversion”
      try {
        const copySource = `${RAW_BUCKET}/${encodeCopySourceKey(srcItem.key)}`;

        await s3.send(
          new CopyObjectCommand({
            Bucket: OUTPUT_BUCKET,
            Key: outKey,
            CopySource: copySource,
            ContentType: outputContentTypeForFormat(outputFormat),
            MetadataDirective: "REPLACE",
            Metadata: {
              source_projectid: projectId,
              source_fileid: fileId,
              kind: "output",
            },
          })
        );
      } catch (e: unknown) {
        results.push({ fileId, ok: false, error: `s3 copy failed: ${getErrorMessage(e)}` });
        continue;
      }

      // Write output FILE row
      const createdAt = nowIso();
      const outSK = `FILE#${projectId}#${outFileId}`;

      const outItem: DbFileItem = {
        PK,
        SK: outSK,
        entity: "FILE",
        kind: "output",
        fileId: outFileId,
        projectId,
        userSub: user.sub,
        filename: outName,
        contentType: outputContentTypeForFormat(outputFormat),
        sizeBytes: null,
        bucket: OUTPUT_BUCKET,
        key: outKey,
        status: "done",
        createdAt,
        updatedAt: createdAt,
        sourceFileId: fileId,
        outputFormat,
        quality: quality ?? null,
        preset: preset ?? null,
      };

      try {
        await ddbDoc.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: outItem,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          })
        );
      } catch (e: unknown) {
        results.push({ fileId, ok: false, error: `ddb put failed: ${getErrorMessage(e)}` });
        continue;
      }

      results.push({ fileId, ok: true, outputFileId: outFileId });
    }

    return NextResponse.json(
      {
        ok: true,
        projectId,
        outputFormat,
        results,
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("POST convert error:", e);
    return jsonError(500, "server_error", msg);
  }
}