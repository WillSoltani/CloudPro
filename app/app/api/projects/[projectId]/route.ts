import { NextResponse } from "next/server";
import { QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc, TABLE_NAME } from "../../_lib/aws";
import { requireUser } from "../../_lib/auth";

type PatchBody = {
  name?: string;
};

function nowIso() {
  return new Date().toISOString();
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

async function findProjectKey(userSub: string, projectId: string): Promise<{ PK: string; SK: string } | null> {
  const PK = `USER#${userSub}`;

  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": PK,
        ":prefix": "PROJECT#",
        ":pid": projectId,
      },
      FilterExpression: "projectId = :pid",
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  const item = res.Items?.[0];
  if (!item) return null;

  const sk = typeof item.SK === "string" ? item.SK : "";
  if (!sk) return null;

  return { PK, SK: sk };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    const body = (await req.json()) as Partial<PatchBody>;
    const name = (body.name ?? "").trim();

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: "name too long" }, { status: 400 });

    const key = await findProjectKey(user.sub, projectId);
    if (!key) return NextResponse.json({ error: "not found" }, { status: 404 });

    const updatedAt = nowIso();

    await ddbDoc.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: key,
        UpdateExpression: "SET #n = :name, updatedAt = :u",
        ExpressionAttributeNames: { "#n": "name" },
        ExpressionAttributeValues: {
          ":name": name,
          ":u": updatedAt,
        },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
      })
    );

    return NextResponse.json({ projectId, name, updatedAt });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) return authErrorResponse(msg);
    console.error("PATCH /app/api/projects/[projectId] error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    const key = await findProjectKey(user.sub, projectId);
    if (!key) return NextResponse.json({ error: "not found" }, { status: 404 });

    await ddbDoc.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: key,
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
      })
    );

    return NextResponse.json({ ok: true, projectId });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) return authErrorResponse(msg);
    console.error("DELETE /app/api/projects/[projectId] error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
