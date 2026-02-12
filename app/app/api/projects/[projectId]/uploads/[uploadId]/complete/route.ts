import { NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc, TABLE_NAME } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

function nowIso() {
  return new Date().toISOString();
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
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

    const body = (await req.json()) as Partial<CompleteUploadBody>;

    const filename = String(body.filename ?? "").trim();
    const contentType = String(body.contentType ?? "application/octet-stream").trim();
    const bucket = String(body.bucket ?? "").trim();
    const key = String(body.key ?? "").trim();

    if (!filename || !bucket || !key) {
      return NextResponse.json(
        { error: "filename, bucket, key are required" },
        { status: 400 }
      );
    }

    if (filename.length > 256) {
      return NextResponse.json({ error: "filename too long" }, { status: 400 });
    }

    const sizeBytes =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes) && body.sizeBytes >= 0
        ? Math.floor(body.sizeBytes)
        : null;

    const createdAt = nowIso();

    // Single-table keys
    const PK = `USER#${user.sub}`;
    const SK = `FILE#${createdAt}#${uploadId}`;

    const item = {
      PK,
      SK,
      entity: "FILE",
      fileId: uploadId, // v1: uploadId === fileId
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
    };

    await ddbDoc.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    return NextResponse.json(
      { file: { fileId: uploadId, status: "queued" } },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);

    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    console.error("POST /app/api/projects/[projectId]/uploads/[uploadId]/complete error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
