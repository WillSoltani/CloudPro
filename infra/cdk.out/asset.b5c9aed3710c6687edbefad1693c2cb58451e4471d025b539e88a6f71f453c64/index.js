"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// asset-input/index.ts
var asset_input_exports = {};
__export(asset_input_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(asset_input_exports);
var import_client_s3 = require("@aws-sdk/client-s3");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_sharp = __toESM(require("sharp"));
function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
var REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";
var s3 = new import_client_s3.S3Client({ region: REGION });
var ddbDoc = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true }
});
var TABLE_NAME = mustEnv("SECURE_DOC_TABLE");
function isUint8Array(v) {
  return v instanceof Uint8Array;
}
function isReadableStream(v) {
  return typeof v === "object" && v !== null && typeof v.on === "function";
}
async function asBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (isUint8Array(body)) return Buffer.from(body);
  if (typeof body === "object" && body !== null && "transformToByteArray" in body && typeof body.transformToByteArray === "function") {
    const fn = body.transformToByteArray;
    const arr = await fn();
    return Buffer.from(arr);
  }
  if (!isReadableStream(body)) throw new Error("GetObject body is not a readable stream");
  return await new Promise((resolve, reject) => {
    const chunks = [];
    body.on("data", (c) => {
      if (Buffer.isBuffer(c)) chunks.push(c);
      else if (isUint8Array(c)) chunks.push(Buffer.from(c));
      else chunks.push(Buffer.from(String(c)));
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
  const q = typeof quality === "number" && Number.isFinite(quality) ? Math.max(1, Math.min(100, Math.floor(quality))) : void 0;
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
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const names = { "#s": "status" };
  const values = {
    ":s": args.status,
    ":u": updatedAt
  };
  const setParts = ["#s = :s", "updatedAt = :u"];
  if (args.contentType) {
    values[":ct"] = args.contentType;
    setParts.push("contentType = :ct");
  }
  if (args.sizeBytes !== void 0) {
    values[":sz"] = typeof args.sizeBytes === "number" ? Math.floor(args.sizeBytes) : args.sizeBytes ?? null;
    setParts.push("sizeBytes = :sz");
  }
  if (args.errorMessage !== void 0) {
    values[":em"] = args.errorMessage ?? null;
    setParts.push("errorMessage = :em");
  }
  await ddbDoc.send(
    new import_lib_dynamodb.UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: args.pk, SK: args.sk },
      UpdateExpression: `SET ${setParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    })
  );
}
async function handler(event) {
  if (!event.ddb?.pk || !event.ddb?.sk) throw new Error("missing ddb keys");
  if (!event.raw?.bucket || !event.raw?.key) throw new Error("missing raw s3 location");
  if (!event.output?.bucket || !event.output?.key) throw new Error("missing output s3 location");
  const fmt = event.outputFormat;
  if (fmt !== "PNG" && fmt !== "JPG" && fmt !== "WebP" && fmt !== "TIFF") {
    await markOutputStatus({
      pk: event.ddb.pk,
      sk: event.ddb.sk,
      status: "failed",
      errorMessage: `unsupported outputFormat for v1: ${fmt}`
    });
    return { ok: false, error: "unsupported_format" };
  }
  await markOutputStatus({ pk: event.ddb.pk, sk: event.ddb.sk, status: "processing" });
  try {
    const got = await s3.send(
      new import_client_s3.GetObjectCommand({ Bucket: event.raw.bucket, Key: event.raw.key })
    );
    const inputBuf = await asBuffer(got.Body);
    const pipeline = (0, import_sharp.default)(inputBuf, { failOn: "none" });
    const converted = await applyOutputFormat(pipeline, fmt, event.quality).toBuffer();
    const outContentType = contentTypeFor(fmt);
    await s3.send(
      new import_client_s3.PutObjectCommand({
        Bucket: event.output.bucket,
        Key: event.output.key,
        Body: converted,
        ContentType: outContentType
      })
    );
    await markOutputStatus({
      pk: event.ddb.pk,
      sk: event.ddb.sk,
      status: "done",
      contentType: outContentType,
      sizeBytes: converted.byteLength,
      errorMessage: null
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "conversion failed";
    await markOutputStatus({
      pk: event.ddb.pk,
      sk: event.ddb.sk,
      status: "failed",
      errorMessage: msg
    });
    throw err;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
