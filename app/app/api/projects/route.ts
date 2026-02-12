import { NextResponse } from "next/server";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc, TABLE_NAME } from "../_lib/aws";
import { requireUser } from "../_lib/auth";

type CreateProjectBody = { name: string };

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
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

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = (await req.json()) as Partial<CreateProjectBody>;
    const name = (body.name ?? "").trim();

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: "name too long" }, { status: 400 });

    const projectId = newId();
    const createdAt = nowIso();

    const PK = `USER#${user.sub}`;
    const SK = `PROJECT#${createdAt}#${projectId}`;

    await ddbDoc.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK,
          SK,
          entity: "PROJECT",
          projectId,
          userSub: user.sub,
          name,
          createdAt,
          updatedAt: createdAt,
          status: "active",
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    return NextResponse.json(
      { project: { projectId, name, createdAt, updatedAt: createdAt, status: "active" } },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) return authErrorResponse(msg);

    console.error("POST /app/api/projects error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const PK = `USER#${user.sub}`;

    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": PK,
          ":skPrefix": "PROJECT#",
        },
        ScanIndexForward: false,
        Limit: 50,
      })
    );

    const projects = (res.Items ?? []).map((it) => ({
      projectId: String(it.projectId),
      name: String(it.name),
      createdAt: String(it.createdAt),
      updatedAt: String(it.updatedAt ?? it.createdAt),
      status: String(it.status ?? "active"),
    }));

    return NextResponse.json({ projects });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (isAuthError(msg)) return authErrorResponse(msg);

    console.error("GET /app/api/projects error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
