import { NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export async function GET(
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

    // Find the file item (your schema: SK starts with FILE#, fileId + projectId are attrs)
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
    const filename = String(item.filename ?? "download");

    const s3 = new S3Client({}); // uses env/role creds
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      { expiresIn: 60 }
    );

    return NextResponse.json({ url });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) {
      return NextResponse.json({ error: msg.toLowerCase() }, { status: 401 });
    }
    console.error("GET download url error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
