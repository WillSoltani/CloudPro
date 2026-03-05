"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
// infra/lib/lambdas/convert-worker/index.ts
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const sharp_1 = __importDefault(require("sharp"));
function mustEnv(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env var: ${name}`);
    return v;
}
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";
const s3 = new client_s3_1.S3Client({ region: REGION });
const ddbDoc = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({ region: REGION }), {
    marshallOptions: { removeUndefinedValues: true },
});
const TABLE_NAME = mustEnv("SECURE_DOC_TABLE");
function isUint8Array(v) {
    return v instanceof Uint8Array;
}
function isReadableStream(v) {
    return typeof v === "object" && v !== null && typeof v.on === "function";
}
async function asBuffer(body) {
    if (Buffer.isBuffer(body))
        return body;
    if (isUint8Array(body))
        return Buffer.from(body);
    // Some runtimes (fetch-like) expose transformToByteArray()
    if (typeof body === "object" &&
        body !== null &&
        "transformToByteArray" in body &&
        typeof body.transformToByteArray === "function") {
        const fn = body.transformToByteArray;
        const arr = await fn();
        return Buffer.from(arr);
    }
    if (!isReadableStream(body))
        throw new Error("GetObject body is not a readable stream");
    return await new Promise((resolve, reject) => {
        const chunks = [];
        body.on("data", (c) => {
            if (Buffer.isBuffer(c))
                chunks.push(c);
            else if (isUint8Array(c))
                chunks.push(Buffer.from(c));
            else
                chunks.push(Buffer.from(String(c)));
        });
        body.on("end", () => resolve(Buffer.concat(chunks)));
        body.on("error", reject);
    });
}
function contentTypeFor(fmt) {
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
function applyOutputFormat(p, fmt, quality) {
    const q = typeof quality === "number" && Number.isFinite(quality)
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
async function markOutputStatus(args) {
    const updatedAt = new Date().toISOString();
    const names = { "#s": "status" };
    const values = {
        ":s": args.status,
        ":u": updatedAt,
    };
    const setParts = ["#s = :s", "updatedAt = :u"];
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
    await ddbDoc.send(new lib_dynamodb_1.UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: args.pk, SK: args.sk },
        UpdateExpression: `SET ${setParts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
    }));
}
async function handler(event) {
    if (!event.ddb?.pk || !event.ddb?.sk)
        throw new Error("missing ddb keys");
    if (!event.raw?.bucket || !event.raw?.key)
        throw new Error("missing raw s3 location");
    if (!event.output?.bucket || !event.output?.key)
        throw new Error("missing output s3 location");
    const fmt = event.outputFormat;
    if (fmt !== "PNG" && fmt !== "JPG" && fmt !== "WebP" && fmt !== "TIFF") {
        await markOutputStatus({
            pk: event.ddb.pk,
            sk: event.ddb.sk,
            status: "failed",
            errorMessage: `unsupported outputFormat for v1: ${fmt}`,
        });
        return { ok: false, error: "unsupported_format" };
    }
    await markOutputStatus({ pk: event.ddb.pk, sk: event.ddb.sk, status: "processing" });
    try {
        const got = await s3.send(new client_s3_1.GetObjectCommand({ Bucket: event.raw.bucket, Key: event.raw.key }));
        const inputBuf = await asBuffer(got.Body);
        const pipeline = (0, sharp_1.default)(inputBuf, { failOn: "none" });
        const converted = await applyOutputFormat(pipeline, fmt, event.quality).toBuffer();
        const outContentType = contentTypeFor(fmt);
        await s3.send(new client_s3_1.PutObjectCommand({
            Bucket: event.output.bucket,
            Key: event.output.key,
            Body: converted,
            ContentType: outContentType,
        }));
        await markOutputStatus({
            pk: event.ddb.pk,
            sk: event.ddb.sk,
            status: "done",
            contentType: outContentType,
            sizeBytes: converted.byteLength,
            errorMessage: null,
        });
        return { ok: true };
    }
    catch (err) {
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
