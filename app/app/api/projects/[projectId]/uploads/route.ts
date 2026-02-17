import "server-only";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { requireUser } from "@/app/app/api/_lib/auth";
import { s3, mustEnv } from "@/app/app/api/_lib/aws";

export const runtime = "nodejs";

type CreateUploadBody = {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
};

function newId() {
  return crypto.randomUUID();
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

function isAuthError(msg: string) {
  return msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN";
}

function authErrorResponse(msg: string) {
  return NextResponse.json({ error: msg.toLowerCase() }, { status: 401 });
}

// Avoid /, control chars, and extreme length in keys
function safeFileName(input: string): string {
  const trimmed = input.trim();
  const base = trimmed.split("/").pop() ?? trimmed; // strip any path
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]+/gu, "_"); // unicode letters/numbers allowed
  const noDots = cleaned.replace(/^\.+/, ""); // avoid ".env" style oddness
  const fallback = noDots || "file";
  return fallback.slice(0, 120);
}

function normalizeContentType(ct: string): string {
  const v = (ct || "").trim().toLowerCase();
  if (!v) return "application/octet-stream";
  // keep it simple; browsers can send odd stuff, but we just need a sane header
  return v.slice(0, 200);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const body = (await req.json()) as CreateUploadBody;

    const rawName = (body.filename ?? "").trim();
    if (!rawName) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    // Optional size validation (client supplied, but still useful as a guardrail)
    const sizeBytes =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes) ? body.sizeBytes : undefined;

    if (sizeBytes != null && (sizeBytes <= 0 || sizeBytes > 250 * 1024 * 1024)) {
      return NextResponse.json({ error: "invalid sizeBytes" }, { status: 400 });
    }

    const filename = safeFileName(rawName);
    const contentType = normalizeContentType(body.contentType ?? "application/octet-stream");

    const bucket = mustEnv("RAW_BUCKET");
    const fileId = newId();

    // Keep keys predictable and safe
    const key = `private/${user.sub}/${projectId}/${fileId}/original/${filename}`;

    // IMPORTANT: If you include Metadata in the signed command, the client must send matching x-amz-meta-* headers.
    const metaHeaders: Record<string, string> = {
      "x-amz-meta-usersub": user.sub,
      "x-amz-meta-projectid": projectId,
      "x-amz-meta-fileid": fileId,
      "content-type": contentType,
    };

    const put = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: {
        usersub: user.sub,
        projectid: projectId,
        fileid: fileId,
      },
      // You can optionally add ContentDisposition to suggest download name:
      // ContentDisposition: `attachment; filename="${filename}"`,
    });

    const putUrl = await getSignedUrl(s3, put, { expiresIn: 60 });

    return NextResponse.json(
      {
        upload: {
          uploadId: fileId,
          fileId,
          key,
          bucket,
          putUrl,
          headers: metaHeaders,
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);

    if (isAuthError(msg)) return authErrorResponse(msg);

    console.error("POST /app/api/projects/[projectId]/uploads error:", e);

    return NextResponse.json(
      {
        error: "server error",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
