import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId, fileId } = await params;

    const PK = `USER#${user.sub}`;
    const SK = `FILE#${projectId}#${fileId}`;

    const got = await ddbDoc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
      })
    );

    const item = got.Item;
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

    const bucket = String(item.bucket ?? "");
    const key = String(item.key ?? "");
    if (bucket && key) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (err) {
        // If the user manually deleted from S3, this can fail. We still delete Dynamo.
        console.warn("DeleteObject failed (continuing):", err);
      }
    }

    await ddbDoc.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("DELETE file error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
