import "server-only";
import { NextResponse } from "next/server";
import { QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

import { ddbDoc, TABLE_NAME, s3 } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

type FileRow = {
  fileId: string;
  projectId: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  bucket: string;
  key: string;
};

type DbFileItem = FileRow & {
  PK: string;
  SK: string;
};

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

function isAuthError(msg: string) {
  return msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN";
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

function toDbFileItem(raw: unknown): DbFileItem | null {
  if (!isRecord(raw)) return null;

  const PK = str(raw.PK);
  const SK = str(raw.SK);

  const fileId = str(raw.fileId);
  const projectId = str(raw.projectId);
  const filename = str(raw.filename);
  const contentType = str(raw.contentType);
  const status = str(raw.status);
  const createdAt = str(raw.createdAt);
  const updatedAt = str(raw.updatedAt);
  const bucket = str(raw.bucket);
  const key = str(raw.key);

  const sizeBytes = numOrNull(raw.sizeBytes);

  if (!PK || !SK || !fileId || !projectId || !filename || !bucket || !key) return null;

  return {
    PK,
    SK,
    fileId,
    projectId,
    filename,
    contentType: contentType || "application/octet-stream",
    sizeBytes,
    status: status || "queued",
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
    bucket,
    key,
  };
}

function awsHttpStatus(e: unknown): number | undefined {
  if (!isRecord(e)) return undefined;
  const md = e.$metadata;
  if (!isRecord(md)) return undefined;
  const code = md.httpStatusCode;
  return typeof code === "number" ? code : undefined;
}

function awsErrorName(e: unknown): string | undefined {
  if (!isRecord(e)) return undefined;
  const n = e.name;
  return typeof n === "string" ? n : undefined;
}

async function headExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e: unknown) {
    const name = awsErrorName(e);
    const status = awsHttpStatus(e);
    if (name === "NotFound" || status === 404) return false;

    // If it’s something else (permissions, throttling), treat as “exists”
    // so we don’t accidentally delete Dynamo records.
    console.warn("HeadObject unexpected error (treating as exists):", e);
    return true;
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function runOne() {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await worker(items[cur]);
    }
  }

  const n = Math.max(1, Math.min(limit, items.length || 1));
  const runners = Array.from({ length: n }, () => runOne());
  await Promise.all(runners);
  return results;
}

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: "bad_request", detail: "projectId is required" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const validate = url.searchParams.get("validate") === "1";

    const PK = `USER#${user.sub}`;

    // NOTE: this assumes your FILE items live under USER#sub and SK starts with FILE#
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": PK,
          ":prefix": "FILE#",
          ":projectId": projectId,
        },
        FilterExpression: "projectId = :projectId",
      })
    );

    const items = (res.Items ?? [])
      .map(toDbFileItem)
      .filter((x): x is DbFileItem => x !== null);

    if (!validate) {
      const files: FileRow[] = items.map(({ PK: _PK, SK: _SK, ...rest }) => rest);
      return NextResponse.json({ files });
    }

    // Validate against S3 (concurrency-limited)
    const checks = await mapLimit(items, 6, async (it) => {
      const exists = await headExists(it.bucket, it.key);
      return { it, exists };
    });

    const missing = checks.filter((c) => !c.exists).map((c) => c.it);

    // Delete missing Dynamo records (best effort)
    await Promise.all(
      missing.map((m) =>
        ddbDoc
          .send(
            new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { PK: m.PK, SK: m.SK },
            })
          )
          .catch((e) => console.warn("DDB delete (missing S3) failed:", e))
      )
    );

    // Return cleaned list
    const cleaned = checks
      .filter((c) => c.exists)
      .map(({ it }) => {
        // strip PK/SK
        const { PK: _PK, SK: _SK, ...rest } = it;
        return rest;
      });

    return NextResponse.json({ files: cleaned, reconciled: { removed: missing.length } });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("GET files error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
