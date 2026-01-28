import { NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/ddb";
import { requireUser } from "@/lib/auth";

const TABLE = process.env.DDB_TABLE_NAME!;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const out = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: {
        PK: `USER#${user.sub}`,
        SK: `PROJECT#${projectId}`,
      },
    })
  );

  if (!out.Item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ project: out.Item });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const body = (await req.json().catch(() => null)) as
    | { name?: unknown }
    | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const out = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: {
        PK: `USER#${user.sub}`,
        SK: `PROJECT#${projectId}`,
      },
      UpdateExpression: "SET #name = :n, updatedAt = :u",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: { ":n": name, ":u": now },
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
      ReturnValues: "ALL_NEW",
    })
  );

  return NextResponse.json({ project: out.Attributes });
}
