// app/app/api/projects/[projectId]/route.ts
import "server-only";
import { QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

import { ddbDoc, TABLE_NAME } from "../../_lib/aws";
import { requireUser } from "../../_lib/auth";
import { withApiErrors, ok, badRequest, notFound } from "../../_lib/http";

export const runtime = "nodejs";

type PatchBody = { name?: string };

function nowIso() {
  return new Date().toISOString();
}

function isConditionalCheckFailed(e: unknown) {
  if (typeof e !== "object" || e === null) return false;
  const any = e as { name?: unknown; __type?: unknown };
  return (
    any.name === "ConditionalCheckFailedException" ||
    any.__type === "ConditionalCheckFailedException"
  );
}

/**
 * Finds the PK/SK for a projectId.
 * Schema note: we cannot direct-lookup by projectId, so we Query the USER partition
 * and Filter by projectId. We paginate because Limit happens before filtering.
 */
async function findProjectKey(
  userSub: string,
  projectId: string
): Promise<{ PK: string; SK: string } | null> {
  const PK = `USER#${userSub}`;
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

  for (let page = 0; page < 20; page += 1) {
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
        ProjectionExpression: "PK, SK",
        ScanIndexForward: false,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 50,
      })
    );

    const items = res.Items ?? [];
    for (const it of items) {
      const sk = typeof it.SK === "string" ? it.SK : "";
      if (sk) return { PK, SK: sk };
    }

    lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    if (!lastEvaluatedKey) break;
  }

  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return withApiErrors<{ error: string } | { ok: boolean; projectId: string }>(async () => {
    const user = await requireUser();
    const { projectId } = await params;

    if (!projectId) return badRequest("projectId is required");

    let body: Partial<PatchBody> = {};
    try {
      body = (await req.json()) as Partial<PatchBody>;
    } catch {
      return badRequest("invalid json");
    }

    const name = (body.name ?? "").trim();
    if (!name) return badRequest("name is required");
    if (name.length > 80) return badRequest("name too long");

    const key = await findProjectKey(user.sub, projectId);
    if (!key) return notFound();

    const updatedAt = nowIso();

    try {
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
    } catch (e) {
      // disappeared between find and update
      if (isConditionalCheckFailed(e)) return notFound();
      throw e;
    }

    return ok({ ok: true, projectId, name, updatedAt });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return withApiErrors<{ error: string } | { ok: boolean; projectId: string }>(async () => {
    const user = await requireUser();
    const { projectId } = await params;

    if (!projectId) return badRequest("projectId is required");

    const key = await findProjectKey(user.sub, projectId);
    if (!key) return notFound();

    try {
      await ddbDoc.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: key,
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        })
      );
    } catch (e) {
      if (isConditionalCheckFailed(e)) return notFound();
      throw e;
    }

    return ok({ ok: true, projectId });
  });
}
