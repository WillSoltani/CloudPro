import "server-only";
import { NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc, TABLE_NAME } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

function nowIso() {
  return new Date().toISOString();
}

function safeFileName(input: string): string {
  const trimmed = input.trim();
  const base = trimmed.split("/").pop() ?? trimmed;
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]+/gu, "_");
  const noDots = cleaned.replace(/^\.+/, "");
  return (noDots || "file").slice(0, 120);
}

function normalizeContentType(ct: string): string {
  const v = (ct || "").trim().toLowerCase();
  return (v || "application/octet-stream").slice(0, 200);
}

function guessContentTypeFromName(filename: string): string {
  const n = filename.toLowerCase();
  if (n.endsWith(".csv")) return "text/csv";
  if (n.endsWith(".json")) return "application/json";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".doc")) return "application/msword";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".xls")) return "application/vnd.ms-excel";
  if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (n.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
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

type CompleteUploadBody = {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  bucket?: string;
  key?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; uploadId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId, uploadId } = await params;

    if (!projectId || !uploadId) {
      return NextResponse.json({ error: "bad_request", detail: "missing params" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<CompleteUploadBody>;

    const rawName = String(body.filename ?? "");
    const filename = safeFileName(rawName);

    const bucket = String(body.bucket ?? "").trim();
    const key = String(body.key ?? "").trim();

    if (!rawName.trim() || !bucket || !key) {
      return NextResponse.json(
        { error: "bad_request", detail: "filename, bucket, key are required" },
        { status: 400 }
      );
    }

    const rawCt = String(body.contentType ?? "").trim();
    const contentType =
      rawCt && rawCt !== "application/octet-stream"
        ? normalizeContentType(rawCt)
        : guessContentTypeFromName(filename);

    const sizeBytes =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes) && body.sizeBytes >= 0
        ? Math.floor(body.sizeBytes)
        : null;

    const createdAt = nowIso();
    const PK = `USER#${user.sub}`;
    const SK = `FILE#${projectId}#${uploadId}`; // ✅ deterministic

    await ddbDoc.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK,
          SK,
          entity: "FILE",
          fileId: uploadId,
          projectId,
          userSub: user.sub,
          filename,
          contentType,
          sizeBytes,
          bucket,
          key,
          status: "queued",
          createdAt,
          updatedAt: createdAt,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    return NextResponse.json({ file: { fileId: uploadId, status: "queued" } }, { status: 201 });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("complete upload error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
