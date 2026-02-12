// app/app/api/projects/[projectId]/files/route.ts
import { NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc, TABLE_NAME } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    const PK = `USER#${user.sub}`;

    // We stored files as: SK = FILE#<createdAt>#<fileId>
    // and included projectId as an attribute. So we query all FILE# and filter to projectId.
    // (Still one DynamoDB query. Filter happens server-side after the query.)
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
        ScanIndexForward: false, // newest first (createdAt is in SK)
        Limit: 50,
      })
    );

    const files =
      (res.Items ?? []).map((it) => ({
        fileId: String(it.fileId),
        projectId: String(it.projectId),
        filename: String(it.filename),
        contentType: String(it.contentType ?? "application/octet-stream"),
        sizeBytes: it.sizeBytes == null ? null : Number(it.sizeBytes),
        status: String(it.status ?? "queued"),
        createdAt: String(it.createdAt),
        updatedAt: String(it.updatedAt ?? it.createdAt),
        bucket: String(it.bucket),
        key: String(it.key),
      })) ?? [];

    return NextResponse.json({ files });
  } catch (e: unknown) {
    const msg = String((e as { message?: unknown })?.message ?? "");
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }
    console.error("GET /app/api/projects/[projectId]/files error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
