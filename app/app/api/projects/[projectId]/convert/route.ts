import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

import { ddbDoc, TABLE_NAME, mustEnv } from "@/app/app/api/_lib/aws";
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

function isRawConvertibleStatus(status: string): boolean {
  const v = (status || "").toLowerCase();
  // Raw uploads are usually queued; if you later mark raw as done, allow that too.
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

function safeExecutionName(projectId: string, outFileId: string): string {
  // SFN execution name: [0-9A-Za-z-_] up to 80 chars
  const raw = `p-${projectId}-o-${outFileId}`;
  return raw.replace(/[^0-9A-Za-z-_]/g, "_").slice(0, 80);
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

    const stateMachineArn = mustEnv("CONVERT_SFN_ARN");
    const sfn = new SFNClient({});

    const PK = `USER#${user.sub}`;
    const results: ConvertResult[] = [];

    for (const fileId of fileIds) {
      const rawSK = `FILE#${projectId}#${fileId}`;

      // 1) Load raw row
      const got = await ddbDoc.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK, SK: rawSK },
        })
      );

      const src = toDbFileItem(got.Item);
      if (!src) {
        results.push({ fileId, ok: false, error: "not found" });
        continue;
      }

      // ownership checks (defense in depth)
      if (src.projectId !== projectId || src.userSub !== user.sub) {
        results.push({ fileId, ok: false, error: "forbidden" });
        continue;
      }

      if (src.kind !== "raw") {
        results.push({ fileId, ok: false, error: "cannot convert an output file" });
        continue;
      }

      if (!isRawConvertibleStatus(src.status)) {
        results.push({ fileId, ok: false, error: `not convertible in status ${src.status}` });
        continue;
      }

      // 2) Create output row (processing)
      const outFileId = crypto.randomUUID();
      const outSK = `FILE#${projectId}#${outFileId}`;
      const createdAt = nowIso();

      const outItem = {
        PK,
        SK: outSK,
        entity: "FILE" as const,
        kind: "output" as const,
        fileId: outFileId,
        projectId,
        userSub: user.sub,

        // filename/contentType will be finalized by the worker (it knows real output)
        filename: src.filename,
        contentType: src.contentType,
        sizeBytes: null as number | null,

        // worker will write OUTPUT_BUCKET + output key
        bucket: "" as string,
        key: "" as string,

        status: "processing",
        createdAt,
        updatedAt: createdAt,

        // traceability
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

      // 3) Start SFN execution (enqueue)
      try {
        const input = {
          userSub: user.sub,
          projectId,
          sourceFileId: fileId,
          outputFileId: outFileId,
          outputFormat,
          quality: quality ?? null,
          preset: preset ?? null,
        };

        await sfn.send(
          new StartExecutionCommand({
            stateMachineArn,
            name: safeExecutionName(projectId, outFileId),
            input: JSON.stringify(input),
          })
        );
      } catch (e: unknown) {
        // If SFN start fails, mark output row as failed so UI reflects reality.
        const msg = getErrorMessage(e);

        try {
          await ddbDoc.send(
            new PutCommand({
              TableName: TABLE_NAME,
              Item: {
                ...outItem,
                status: "failed",
                updatedAt: nowIso(),
                errorMessage: msg,
              },
              // overwrite the same item intentionally
            })
          );
        } catch {
          // ignore secondary failure; we still return failure for this file
        }

        results.push({ fileId, ok: false, error: `enqueue failed: ${msg}` });
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