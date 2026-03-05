// infra/lambda/convert-worker.ts
import "source-map-support/register";
import type { Context } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import sharp from "sharp";

type OutputFormat = "PNG" | "JPG" | "WebP" | "GIF" | "SVG" | "ICO" | "BMP" | "TIFF";

type ConvertJob = {
  userSub: string;
  projectId: string;

  // Source raw file
  source: {
    fileId: string;
    bucket: string;
    key: string;
    filename: string;
    contentType: string;
  };

  // Output row already created by /convert
  output: {
    fileId: string;
    bucket: string;
    key: string;
    outputFormat: OutputFormat;
    quality?: number;
    preset?: string;
  };

  // Dynamo identifiers
  tableName: string;
};

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function nowIso() {
  return new Date().toISOString();
}

function contentTypeFor(fmt: OutputFormat): string {
  switch (fmt) {
    case "PNG":
      return "image/png";
    case "JPG":
      return "image/jpeg";
    case "WebP":
      return "image/webp";
    case "GIF":
      return "image/gif";
    case "SVG":
      return "image/svg+xml";
    case "ICO":
      return "image/x-icon";
    case "BMP":
      return "image/bmp";
    case "TIFF":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) throw new Error("S3 body is empty");

  // Node 18/20: Body is typically a Readable stream
  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks: Buffer[] = [];
  const readable = body as NodeJS.ReadableStream;

  return await new Promise<Buffer>((resolve, reject) => {
    readable.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

function normalizeQuality(q: unknown): number | undefined {
  if (typeof q !== "number" || !Number.isFinite(q)) return undefined;
  const v = Math.floor(q);
  if (v < 1) return 1;
  if (v > 100) return 100;
  return v;
}

async function markOutputStatus(args: {
  tableName: string;
  userSub: string;
  projectId: string;
  outputFileId: string;
  status: "processing" | "done" | "failed";
  sizeBytes?: number | null;
  errorMessage?: string | null;
}) {
  const { tableName, userSub, projectId, outputFileId, status, sizeBytes, errorMessage } = args;

  const PK = `USER#${userSub}`;
  const SK = `FILE#${projectId}#${outputFileId}`;
  const updatedAt = nowIso();

  const exprNames: Record<string, string> = {
    "#s": "status",
  };

  const exprValues: Record<string, unknown> = {
    ":s": status,
    ":u": updatedAt,
    ":sz": typeof sizeBytes === "number" ? sizeBytes : null,
    ":err": errorMessage ?? null,
  };

  // Keep it simple and idempotent. If the row is missing, this will fail,
  // which is good: it indicates /convert didn't create the output row.
  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK, SK },
      UpdateExpression: "SET #s = :s, updatedAt = :u, sizeBytes = :sz, errorMessage = :err",
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    })
  );
}

export async function handler(event: unknown, _ctx: Context) {
  const job = event as ConvertJob;

  if (!job?.tableName || !job?.userSub || !job?.projectId) {
    throw new Error("invalid job payload (missing tableName/userSub/projectId)");
  }
  if (!job.source?.bucket || !job.source?.key || !job.output?.bucket || !job.output?.key) {
    throw new Error("invalid job payload (missing buckets/keys)");
  }

  // mark processing (best-effort)
  await markOutputStatus({
    tableName: job.tableName,
    userSub: job.userSub,
    projectId: job.projectId,
    outputFileId: job.output.fileId,
    status: "processing",
    sizeBytes: null,
    errorMessage: null,
  });

  try {
    const getRes = await s3.send(new GetObjectCommand({ Bucket: job.source.bucket, Key: job.source.key }));
    const inputBuf = await streamToBuffer(getRes.Body);

    const fmt = job.output.outputFormat;
    const q = normalizeQuality(job.output.quality);

    let pipeline = sharp(inputBuf, { failOn: "none" });

    // Convert based on requested output format
    switch (fmt) {
      case "PNG":
        pipeline = pipeline.png();
        break;
      case "JPG":
        pipeline = pipeline.jpeg({ quality: q ?? 80 });
        break;
      case "WebP":
        pipeline = pipeline.webp({ quality: q ?? 80 });
        break;
      case "GIF":
        // sharp has limited GIF output support; this may throw depending on build.
        // For Step 1: allow it to fail and mark row failed.
        pipeline = pipeline.gif();
        break;
      case "SVG":
        // Not a typical raster output. For Step 1: fail clearly.
        throw new Error("SVG output not supported in Step 1");
      case "ICO":
        throw new Error("ICO output not supported in Step 1");
      case "BMP":
        pipeline = pipeline.png();
        break;
      case "TIFF":
        pipeline = pipeline.tiff();
        break;
      default:
        throw new Error(`unsupported output format: ${String(fmt)}`);
    }

    const outBuf = await pipeline.toBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: job.output.bucket,
        Key: job.output.key,
        Body: outBuf,
        ContentType: contentTypeFor(fmt),
      })
    );

    await markOutputStatus({
      tableName: job.tableName,
      userSub: job.userSub,
      projectId: job.projectId,
      outputFileId: job.output.fileId,
      status: "done",
      sizeBytes: outBuf.byteLength,
      errorMessage: null,
    });

    return { ok: true, outputFileId: job.output.fileId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "conversion failed";

    await markOutputStatus({
      tableName: job.tableName,
      userSub: job.userSub,
      projectId: job.projectId,
      outputFileId: job.output.fileId,
      status: "failed",
      sizeBytes: null,
      errorMessage: msg.slice(0, 500),
    });

    throw err;
  }
}