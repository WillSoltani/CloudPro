// app/app/api/projects/route.ts
import "server-only";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { ddbDoc, TABLE_NAME } from "../_lib/aws";
import { requireUser } from "../_lib/auth";
import { withApiErrors, ok, badRequest, conflict } from "../_lib/http";

export const runtime = "nodejs";

type CreateProjectBody = { name: string };

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function readStringProp(obj: unknown, key: string): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "string" ? v : undefined;
}

function isConditionalCheckFailed(e: unknown) {
  const name = readStringProp(e, "name");
  const type = readStringProp(e, "__type");
  return name === "ConditionalCheckFailedException" || type === "ConditionalCheckFailedException";
}

export async function POST(req: Request) {
  return withApiErrors<
    { error: string } | { project: { projectId: string; name: string; createdAt: string; updatedAt: string; status: string } }
  >(async () => {
    const user = await requireUser();

    let body: Partial<CreateProjectBody> = {};
    try {
      body = (await req.json()) as Partial<CreateProjectBody>;
    } catch {
      return badRequest("invalid json");
    }

    const name = (body.name ?? "").trim();
    if (!name) return badRequest("name is required");
    if (name.length > 80) return badRequest("name too long");

    const projectId = newId();
    const createdAt = nowIso();

    const PK = `USER#${user.sub}`;
    const SK = `PROJECT#${createdAt}#${projectId}`;

    try {
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
    } catch (e: unknown) {
      if (isConditionalCheckFailed(e)) return conflict("project already exists");
      throw e;
    }

    return ok({ project: { projectId, name, createdAt, updatedAt: createdAt, status: "active" } }, 201);
  });
}

export async function GET() {
  return withApiErrors(async () => {
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

    return ok({ projects });
  });
}
