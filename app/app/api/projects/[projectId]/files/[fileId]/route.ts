import { NextResponse } from "next/server";
import { QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { ddbDoc, TABLE_NAME } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

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

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; fileId: string }>;
  }
) {
  try {
    const user = await requireUser();
    const { projectId, fileId } = await params;

    const PK = `USER#${user.sub}`;

    // Locate the exact item so we can delete by PK+SK
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": PK,
          ":prefix": "FILE#",
          ":projectId": projectId,
          ":fileId": fileId,
        },
        FilterExpression: "projectId = :projectId AND fileId = :fileId",
        Limit: 1,
      })
    );

    const item = (res.Items ?? [])[0];
    if (!item) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const bucket = String(item.bucket);
    const key = String(item.key);
    const SK = String(item.SK);

    // Delete S3 object first (ok if it already doesn't exist)
    const s3 = new S3Client({});
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      console.warn("DeleteObject failed (continuing):", err);
    }

    // Delete Dynamo record
    await ddbDoc.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) {
      return NextResponse.json({ error: msg.toLowerCase() }, { status: 401 });
    }
    console.error("DELETE file error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
