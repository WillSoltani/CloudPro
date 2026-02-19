// app/app/api/projects/[projectId]/uploads/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { ddbDoc, TABLE_NAME, s3, mustEnv } from "@/app/app/api/_lib/aws";
import { requireUser, AuthError } from "@/app/app/api/_lib/auth";

export const runtime = "nodejs";

type CreateUploadBody = {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
};

type ProjectLookup = { name: string; status: string } | null;

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}

function safeFileName(input: string): string {
  const trimmed = input.trim();
  const base = trimmed.split("/").pop() ?? trimmed;
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]+/gu, "_");
  const noDots = cleaned.replace(/^\.+/, "");
  return (noDots || "file").slice(0, 120);
}

function normalizeContentType(ct: string): string {
  const v = (ct || "").trim();
  return (v || "application/octet-stream").slice(0, 200);
}

function slugify(input: string): string {
  const s = (input || "").trim().toLowerCase();
  const cleaned = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "untitled";
}

function readString(obj: unknown, key: string): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "string" ? v : undefined;
}

function userSlugFromClaims(user: { name?: unknown; email?: unknown }): string {
  const name = typeof user.name === "string" ? user.name.trim() : "";
  if (name) return slugify(name);

  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email) {
    const local = email.split("@")[0] || "user";
    return slugify(local);
  }

  return "user";
}

/**
 * IMPORTANT:
 * - No Limit:1 with FilterExpression (Limit applies before filter).
 * - ConsistentRead so create->upload immediately works.
 * - Paginate until found.
 * - Do NOT inject "Untitled Project" as a name. Return the real stored value.
 */
async function fetchProjectById(userSub: string, projectId: string): Promise<ProjectLookup> {
  const PK = `USER#${userSub}`;
  let lastKey: Record<string, unknown> | undefined;

  for (let page = 0; page < 50; page += 1) {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        ConsistentRead: true,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": PK,
          ":prefix": "PROJECT#",
          ":pid": projectId,
        },
        FilterExpression: "projectId = :pid",
        Limit: 50,
        ExclusiveStartKey: lastKey as never,
        ProjectionExpression: "projectId, #n, #s",
        ExpressionAttributeNames: {
          "#n": "name",
          "#s": "status",
        },
      })
    );

    for (const it of res.Items ?? []) {
      const pid = readString(it, "projectId");
      if (pid !== projectId) continue;

      const name = (readString(it, "name") ?? "").trim();
      const status = (readString(it, "status") ?? "active").trim() || "active";
      return { name, status };
    }

    if (!res.LastEvaluatedKey) return null;
    lastKey = res.LastEvaluatedKey as unknown as Record<string, unknown>;
  }

  return null;
}

function buildRawKey(args: {
  userSub: string;
  userSlug: string;
  projectId: string;
  projectSlug: string;
  fileId: string;
  filename: string;
}) {
  const { userSub, userSlug, projectId, projectSlug, fileId, filename } = args;
  // desired shape: project-name first, then id
  return `private/${userSub}/${userSlug}/projects/${projectSlug}--${projectId}/raw/${fileId}/${filename}`;
}

function fallbackProjectSlug(projectId: string): string {
  // Never "untitled-project". Use a stable deterministic fallback if name is missing.
  const short = projectId.slice(0, 8) || "project";
  return `project-${short}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    if (!projectId) return jsonError(400, "bad_request", "projectId is required");

    let body: CreateUploadBody = {};
    try {
      body = (await req.json()) as CreateUploadBody;
    } catch {
      return jsonError(400, "bad_request", "invalid json");
    }

    const rawName = (body.filename ?? "").trim();
    if (!rawName) return jsonError(400, "bad_request", "filename is required");

    const sizeBytes =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes) ? body.sizeBytes : undefined;

    if (sizeBytes != null && (sizeBytes <= 0 || sizeBytes > 250 * 1024 * 1024)) {
      return jsonError(400, "bad_request", "invalid sizeBytes");
    }

    const filename = safeFileName(rawName);
    const contentType = normalizeContentType(body.contentType ?? "");

    // Ensure project exists (and isn't deleted)
    const project = await fetchProjectById(user.sub, projectId);
    if (!project) return jsonError(404, "not_found", "project not found");
    if ((project.status || "active") !== "active") return jsonError(410, "gone", "project is not active");

    const bucket = mustEnv("RAW_BUCKET");
    const fileId = crypto.randomUUID();

    const userSlug = userSlugFromClaims({
      name: (user as unknown as { name?: unknown }).name,
      email: (user as unknown as { email?: unknown }).email,
    });

    const projectSlug = project.name ? slugify(project.name) : fallbackProjectSlug(projectId);

    const key = buildRawKey({
      userSub: user.sub,
      userSlug,
      projectId,
      projectSlug,
      fileId,
      filename,
    });

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const putUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });

    return NextResponse.json(
      {
        upload: {
          uploadId: fileId,
          fileId,
          bucket,
          key,
          putUrl,
          headers: {
            "Content-Type": contentType,
          },
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    if (e instanceof AuthError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const msg = e instanceof Error ? e.message : String(e);
    console.error("POST uploads error:", e);
    return jsonError(500, "server_error", msg);
  }
}
