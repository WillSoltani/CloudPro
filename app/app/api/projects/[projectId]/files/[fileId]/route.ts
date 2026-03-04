// app/app/api/projects/[projectId]/files/[fileId]/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { ddbDoc, TABLE_NAME, s3 } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function awsHttpStatus(e: unknown): number | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const rec = e as Record<string, unknown>;
  const md = rec.$metadata;
  if (typeof md !== "object" || md === null) return undefined;
  const mdr = md as Record<string, unknown>;
  const code = mdr.httpStatusCode;
  return typeof code === "number" ? code : undefined;
}

function awsErrorName(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const rec = e as Record<string, unknown>;
  const name = rec.name;
  return typeof name === "string" ? name : undefined;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId, fileId } = await params;

    if (!projectId || !fileId) {
      return NextResponse.json(
        { error: "bad_request", detail: "missing params" },
        { status: 400 }
      );
    }

    const PK = `USER#${user.sub}`;
    const SK = `FILE#${projectId}#${fileId}`;

    // 1) Read row (optional). If it exists, attempt S3 delete best-effort.
    const got = await ddbDoc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
      })
    );

    const item = got.Item;

    if (item) {
      const bucket = str(item.bucket);
      const key = str(item.key);

      if (bucket && key) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        } catch (e: unknown) {
          // If already deleted from S3, that's fine.
          const status = awsHttpStatus(e);
          const name = awsErrorName(e);
          const notFoundish = status === 404 || name === "NotFound" || name === "NoSuchKey";
          if (!notFoundish) {
            console.warn("DeleteObject failed (continuing):", e);
          }
        }
      }
    }

    // 2) Delete Dynamo row (idempotent).
    await ddbDoc.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
      })
    );

    return NextResponse.json({ ok: true, fileId });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("DELETE file error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}