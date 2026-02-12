import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { requireUser } from "@/app/app/api/_lib/auth";
import { s3, mustEnv } from "@/app/app/api/_lib/aws";

type CreateUploadBody = {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
};

function newId() {
  return crypto.randomUUID();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser();
    const { projectId } = await params;

    const body = (await req.json()) as CreateUploadBody;

    const filename = (body.filename ?? "").trim();
    const contentType = (body.contentType ?? "application/octet-stream").trim();

    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    const bucket = mustEnv("RAW_BUCKET");
    const fileId = newId();

    const key = `private/${user.sub}/${projectId}/${fileId}/original/${filename}`;

    const put = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: {
        usersub: user.sub,
        projectid: projectId,
        fileid: fileId,
      },
    });

    const url = await getSignedUrl(s3, put, { expiresIn: 60 });

    return NextResponse.json({
      upload: {
        uploadId: fileId,
        fileId,
        key,
        bucket,
        putUrl: url,
        headers: { "Content-Type": contentType },
      },
    });
} catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }

    console.error("POST /app/api/projects/[projectId]/uploads error:", e);

    // DEV: return message so you can actually debug
    return NextResponse.json(
      {
        error: "server error",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }

}
