// app/app/api/me/stats/route.ts
import { NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc, TABLE_NAME } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const PK = `USER#${user.sub}`;

    // Projects count
    const projRes = await ddbDoc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :pfx)",
        ExpressionAttributeValues: { ":pk": PK, ":pfx": "PROJECT#" },
        Select: "COUNT",
      })
    );

    // Files + total bytes (uploads so far)
    const fileRes = await ddbDoc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :pfx)",
        ExpressionAttributeValues: { ":pk": PK, ":pfx": "FILE#" },
        Limit: 250, // fine for now; we can paginate later
      })
    );

    const totalProjects = Number(projRes.Count ?? 0);

    const files = fileRes.Items ?? [];
    const filesConverted = files.length; // “uploaded” for now (until pipeline exists)
    const bytes = files.reduce((sum, it) => {
      const n = it?.sizeBytes == null ? 0 : Number(it.sizeBytes);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

    // “space saved” is unknown until conversion exists.
    // For now show 0, but keep UI wired.
    const spaceSavedBytes = 0;

    return NextResponse.json({
      totalProjects,
      filesConverted,
      spaceSavedBytes,
      uploadedBytes: bytes,
    });
  } catch (e: unknown) {
    const msg = String((e as { message?: unknown })?.message ?? "");
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("GET /app/api/me/stats error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
