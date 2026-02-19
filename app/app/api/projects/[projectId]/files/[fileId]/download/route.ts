import "server-only";
import { NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export async function GET(
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
    const filename = String(item.filename ?? "download");

    const inlineUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 60 }
    );

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      { expiresIn: 60 }
    );

    return NextResponse.json({ inlineUrl, downloadUrl });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("GET download url error:", e);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
