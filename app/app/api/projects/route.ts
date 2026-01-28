import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/ddb";
import { requireUser } from "@/lib/auth";

const TABLE = process.env.DDB_TABLE_NAME!;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const PK = `USER#${user.sub}`;

  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :pfx)",
      ExpressionAttributeValues: {
        ":pk": PK,
        ":pfx": "PROJECT#",
      },
      Limit: 50,
    })
  );

  const projects = (out.Items ?? []).map((i) => ({
    projectId: i.projectId,
    name: i.name,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { name?: unknown }
    | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return badRequest("name is required");
  if (name.length > 80) return badRequest("name too long (max 80)");

  const now = new Date().toISOString();
  const projectId = ulid();

  const item = {
    PK: `USER#${user.sub}`,
    SK: `PROJECT#${projectId}`,
    entity: "Project",
    projectId,
    name,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    })
  );

  return NextResponse.json({ project: { projectId, name, createdAt: now } }, { status: 201 });
}
