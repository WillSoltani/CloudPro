import "server-only";
import { NextResponse } from "next/server";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

import { ddbDoc, TABLE_NAME, mustEnv } from "@/app/app/api/_lib/aws";
import { requireUser } from "@/app/app/api/_lib/auth";
import {
  allowedOutputFormatsForFile,
  sourceLabelFromFilenameOrContentType,
} from "@/app/app/_lib/conversion-support";
import {
  type ConversionJobInput,
  type ConvertBody,
  type ConvertResult,
  contentTypeFor,
  extForFormat,
  getErrorMessage,
  isImageOutput,
  isRawConvertibleStatus,
  nowIso,
  parseConversionJob,
  replaceExt,
  safeExecutionName,
  str,
  stripExt,
  toDbFileItem,
  isRecord,
} from "./_lib/convert-route-utils";

export const runtime = "nodejs";

type ProjectLookup = { status: string };

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, detail: process.env.NODE_ENV !== "production" ? detail : undefined },
    { status }
  );
}


async function fetchProjectById(userSub: string, projectId: string): Promise<ProjectLookup | null> {
  const PK = `USER#${userSub}`;
  let lastKey: Record<string, unknown> | undefined;
  for (let page = 0; page < 50; page += 1) {
    const res = await ddbDoc.send(new QueryCommand({
      TableName: TABLE_NAME, ConsistentRead: true,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": PK, ":prefix": "PROJECT#", ":pid": projectId },
      FilterExpression: "projectId = :pid",
      ProjectionExpression: "projectId, #s",
      ExpressionAttributeNames: { "#s": "status" },
      ExclusiveStartKey: lastKey as never, Limit: 50,
    }));
    for (const it of res.Items ?? []) {
      if (!isRecord(it)) continue;
      if (str(it.projectId) !== projectId) continue;
      return { status: str(it.status) || "active" };
    }
    if (!res.LastEvaluatedKey) return null;
    lastKey = res.LastEvaluatedKey as unknown as Record<string, unknown>;
  }
  return null;
}


export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser();
    const { projectId } = await params;
    if (!projectId) return jsonError(400, "bad_request", "projectId is required");

    const project = await fetchProjectById(user.sub, projectId);
    if (!project) return jsonError(404, "not_found", "project not found");
    if ((project.status || "active") !== "active") return jsonError(410, "gone", "project is not active");

    let body: ConvertBody = {};
    try { body = (await req.json()) as ConvertBody; } catch { return jsonError(400, "bad_request", "invalid json"); }

    if (!Array.isArray(body.conversions) || body.conversions.length === 0)
      return jsonError(400, "bad_request", "conversions must be a non-empty array");
    if (body.conversions.length > 25)
      return jsonError(400, "bad_request", "too many conversions (max 25)");

    const jobs = body.conversions.map(parseConversionJob).filter((j): j is ConversionJobInput => j !== null);
    if (jobs.length === 0) return jsonError(400, "bad_request", "no valid conversion jobs");

    // Deduplicate by fileId (keep last)
    const seen = new Map<string, ConversionJobInput>();
    for (const j of jobs) seen.set(j.fileId, j);

    const stateMachineArn = mustEnv("CONVERT_SFN_ARN");
    const outputBucketName = mustEnv("OUTPUT_BUCKET");
    const sfn = new SFNClient({});
    const PK = `USER#${user.sub}`;
    const results: ConvertResult[] = [];

    for (const [, job] of seen) {
      const { fileId, outputFormat, quality, preset, resizePct } = job;
      const rawSK = `FILE#${projectId}#${fileId}`;

      const got = await ddbDoc.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK: rawSK } }));
      const src = toDbFileItem(got.Item);
      if (!src) { results.push({ fileId, ok: false, error: "not found" }); continue; }
      if (src.projectId !== projectId || src.userSub !== user.sub) { results.push({ fileId, ok: false, error: "forbidden" }); continue; }
      if (src.kind !== "raw") { results.push({ fileId, ok: false, error: "cannot convert an output file" }); continue; }
      if (!isRawConvertibleStatus(src.status)) { results.push({ fileId, ok: false, error: `not convertible in status ${src.status}` }); continue; }
      const sourceLabel = sourceLabelFromFilenameOrContentType(src.filename, src.contentType);
      const allowedTargets = allowedOutputFormatsForFile(src.filename, src.contentType);
      if (!allowedTargets.includes(outputFormat)) {
        results.push({
          fileId,
          ok: false,
          error: `unsupported conversion: ${sourceLabel} cannot be converted to ${outputFormat}`,
        });
        continue;
      }

      const outFileId = crypto.randomUUID();
      const outSK = `FILE#${projectId}#${outFileId}`;
      const createdAt = nowIso();
      const srcIsPdf = sourceLabel === "PDF";
      const srcIsDocx = sourceLabel === "DOCX";
      const srcIsPages = sourceLabel === "PAGES";
      const isDocumentImageZip =
        (srcIsPdf || srcIsDocx || srcIsPages) && isImageOutput(outputFormat);

      const outputFilename = isDocumentImageZip
        ? `${stripExt(src.filename)}_${outputFormat.toLowerCase()}_pages.zip`
        : replaceExt(src.filename, extForFormat(outputFormat));
      const outputKey = `private/${user.sub}/${projectId}/output/${outFileId}/${outputFilename}`;

      const outItem = {
        PK, SK: outSK, entity: "FILE" as const, kind: "output" as const,
        fileId: outFileId, projectId, userSub: user.sub,
        filename: outputFilename,
        contentType: isDocumentImageZip ? "application/zip" : contentTypeFor(outputFormat),
        sizeBytes: null as number | null,
        bucket: outputBucketName, key: outputKey,
        status: "processing", createdAt, updatedAt: createdAt,
        artifactType: "conversion" as const,
        sourceFileId: fileId, sourceContentType: src.contentType, outputFormat, quality, preset, resizePct,
        packaging: isDocumentImageZip ? "zip" : "single",
      };

      try {
        await ddbDoc.send(new PutCommand({
          TableName: TABLE_NAME, Item: outItem,
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        }));
      } catch (e: unknown) {
        results.push({ fileId, ok: false, error: `ddb put failed: ${getErrorMessage(e)}` });
        continue;
      }

      try {
        await sfn.send(new StartExecutionCommand({
          stateMachineArn,
          name: safeExecutionName(projectId, outFileId),
          input: JSON.stringify({ userSub: user.sub, projectId, sourceFileId: fileId, outputFileId: outFileId, outputFormat, quality, preset, resizePct }),
        }));
      } catch (e: unknown) {
        const msg = getErrorMessage(e);
        try {
          await ddbDoc.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: { ...outItem, status: "failed", updatedAt: nowIso(), errorMessage: msg },
          }));
        } catch { /* ignore */ }
        results.push({ fileId, ok: false, error: `enqueue failed: ${msg}` });
        continue;
      }

      results.push({ fileId, ok: true, outputFileId: outFileId });
    }

    return NextResponse.json({ ok: true, projectId, results }, { status: 200 });
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    if (msg === "UNAUTHENTICATED" || msg === "INVALID_TOKEN")
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    console.error("POST convert error:", e);
    return jsonError(500, "server_error", msg);
  }
}
