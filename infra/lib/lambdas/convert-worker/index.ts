// infra/lib/lambdas/convert-worker/index.ts
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import sharp from "sharp";

type OutputFormat = "PNG" | "JPG" | "WebP" | "TIFF";

type ConvertEvent = {
  userSub: string;
  projectId: string;

  raw: {
    bucket: string;
    key: string;
    fileId: string;
    filename: string;
    contentType: string;
  };

  output: {
    bucket: string;
    key: string;
    fileId: string;
    filename: string;
  };

  ddb: {
    pk: string;
    sk: string;
  };

  outputFormat: OutputFormat;
  quality?: number;
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";

const s3 = new S3Client({ region: REGION });
const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = mustEnv("SECURE_DOC_TABLE");

function isUint8Array(v: unknown): v is Uint8Array {
  return v instanceof Uint8Array;
}

function isReadableStream(v: unknown): v is NodeJS.ReadableStream {
  return typeof v === "object" && v !== null && typeof (v as NodeJS.ReadableStream).on === "function";
}

async function asBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (isUint8Array(body)) return Buffer.from(body);

  // Some runtimes (fetch-like) expose transformToByteArray()
  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function"
  ) {
    const fn = (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray;
    const arr = await fn();
    return Buffer.from(arr);
  }

  if (!isReadableStream(body)) throw new Error("GetObject body is not a readable stream");

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    body.on("data", (c: unknown) => {
      if (Buffer.isBuffer(c)) chunks.push(c);
      else if (isUint8Array(c)) chunks.push(Buffer.from(c));
      else chunks.push(Buffer.from(String(c)));
    });
    body.on("end", () => resolve(Buffer.concat(chunks)));
    body.on("error", reject);
  });
}

function contentTypeFor(fmt: OutputFormat): string {
  switch (fmt) {
    case "PNG":
      return "image/png";
    case "JPG":
      return "image/jpeg";
    case "WebP":
      return "image/webp";
    case "TIFF":
      return "image/tiff";
  }
}

function applyOutputFormat(p: sharp.Sharp, fmt: OutputFormat, quality?: number): sharp.Sharp {
  const q =
    typeof quality === "number" && Number.isFinite(quality)
      ? Math.max(1, Math.min(100, Math.floor(quality)))
      : undefined;

  switch (fmt) {
    case "PNG":
      return p.png({ compressionLevel: 9 });
    case "JPG":
      return p.jpeg({ quality: q ?? 80, mozjpeg: true });
    case "WebP":
      return p.webp({ quality: q ?? 80 });
    case "TIFF":
      return p.tiff({ quality: q ?? 80 });
  }
}

async function markOutputStatus(args: {
  pk: string;
  sk: string;
  status: "processing" | "done" | "failed";
  contentType?: string;
  sizeBytes?: number | null;
  errorMessage?: string | null;
}) {
  const updatedAt = new Date().toISOString();

  const names: Record<string, string> = { "#s": "status" };
  const values: Record<string, unknown> = {
    ":s": args.status,
    ":u": updatedAt,
  };

  const setParts: string[] = ["#s = :s", "updatedAt = :u"];

  if (args.contentType) {
    values[":ct"] = args.contentType;
    setParts.push("contentType = :ct");
  }

  if (args.sizeBytes !== undefined) {
    values[":sz"] =
      typeof args.sizeBytes === "number" ? Math.floor(args.sizeBytes) : args.sizeBytes ?? null;
    setParts.push("sizeBytes = :sz");
  }

  if (args.errorMessage !== undefined) {
    values[":em"] = args.errorMessage ?? null;
    setParts.push("errorMessage = :em");
  }

  await ddbDoc.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: args.pk, SK: args.sk },
      UpdateExpression: `SET ${setParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function handler(event: ConvertEvent) {
  if (!event.ddb?.pk || !event.ddb?.sk) throw new Error("missing ddb keys");
  if (!event.raw?.bucket || !event.raw?.key) throw new Error("missing raw s3 location");
  if (!event.output?.bucket || !event.output?.key) throw new Error("missing output s3 location");

  const fmt = event.outputFormat;
  if (fmt !== "PNG" && fmt !== "JPG" && fmt !== "WebP" && fmt !== "TIFF") {
    await markOutputStatus({
      pk: event.ddb.pk,
      sk: event.ddb.sk,
      status: "failed",
      errorMessage: `unsupported outputFormat for v1: ${fmt}`,
    });
    return { ok: false, error: "unsupported_format" } as const;
  }

  await markOutputStatus({ pk: event.ddb.pk, sk: event.ddb.sk, status: "processing" });

  try {
    const got = await s3.send(
      new GetObjectCommand({ Bucket: event.raw.bucket, Key: event.raw.key })
    );
    const inputBuf = await asBuffer(got.Body);

    const pipeline = sharp(inputBuf, { failOn: "none" });
    const converted = await applyOutputFormat(pipeline, fmt, event.quality).toBuffer();

    const outContentType = contentTypeFor(fmt);

    await s3.send(
      new PutObjectCommand({
        Bucket: event.output.bucket,
        Key: event.output.key,
        Body: converted,
        ContentType: outContentType,
      })
    );

    await markOutputStatus({
      pk: event.ddb.pk,
      sk: event.ddb.sk,
      status: "done",
      contentType: outContentType,
      sizeBytes: converted.byteLength,
      errorMessage: null,
    });

    return { ok: true } as const;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "conversion failed";
    await markOutputStatus({
      pk: event.ddb.pk,
      sk: event.ddb.sk,
      status: "failed",
      errorMessage: msg,
    });
    throw err;
  }
}