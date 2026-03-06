// infra/lib/lambdas/convert-worker/index.ts
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import sharp from "sharp";

type OutputFormat = "PNG" | "JPG" | "WebP" | "GIF" | "TIFF" | "AVIF" | "DOCX" | "PDF";
type ImageOutputFormat = Exclude<OutputFormat, "DOCX" | "PDF">;

type ConvertEvent = {
  userSub: string;
  projectId: string;
  sourceFileId: string;
  outputFileId: string;
  outputFormat: OutputFormat;
  quality: number | null;
  preset: string | null;
  resizePct: number | null;
};

interface PresetConfig {
  maxWidth?: number;
  jpegQuality: number;
  webpQuality: number;
  pngCompressionLevel: number;
  tiffQuality: number;
  jpegProgressive: boolean;
  jpegChromaSubsampling: string;
}

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";
const TABLE_NAME = process.env.SECURE_DOC_TABLE as string;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET as string;

const s3 = new S3Client({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

function presetConfig(preset: string | null): PresetConfig {
  switch (preset) {
    case "web":
      return {
        maxWidth: 1920,
        jpegQuality: 80, webpQuality: 80, pngCompressionLevel: 6, tiffQuality: 80,
        jpegProgressive: true, jpegChromaSubsampling: "4:2:0",
      };
    case "hq":
      return {
        jpegQuality: 95, webpQuality: 95, pngCompressionLevel: 3, tiffQuality: 95,
        jpegProgressive: false, jpegChromaSubsampling: "4:4:4",
      };
    case "email":
      return {
        maxWidth: 800,
        jpegQuality: 70, webpQuality: 70, pngCompressionLevel: 9, tiffQuality: 70,
        jpegProgressive: true, jpegChromaSubsampling: "4:2:0",
      };
    default:
      return {
        jpegQuality: 80, webpQuality: 80, pngCompressionLevel: 6, tiffQuality: 80,
        jpegProgressive: false, jpegChromaSubsampling: "4:2:0",
      };
  }
}

function extForFormat(fmt: OutputFormat): string {
  const map: Record<OutputFormat, string> = {
    PNG: "png",
    JPG: "jpg",
    WebP: "webp",
    GIF: "gif",
    TIFF: "tiff",
    AVIF: "avif",
    DOCX: "docx",
    PDF: "pdf",
  };
  return map[fmt];
}

function contentTypeFor(fmt: OutputFormat): string {
  const map: Record<OutputFormat, string> = {
    PNG: "image/png",
    JPG: "image/jpeg",
    WebP: "image/webp",
    GIF: "image/gif",
    TIFF: "image/tiff",
    AVIF: "image/avif",
    DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    PDF: "application/pdf",
  };
  return map[fmt];
}

function replaceExt(filename: string, ext: string): string {
  const dot = filename.lastIndexOf(".");
  return (dot < 0 ? filename : filename.slice(0, dot)) + "." + ext;
}

function isUint8Array(v: unknown): v is Uint8Array {
  return v instanceof Uint8Array;
}

function isReadableStream(v: unknown): v is NodeJS.ReadableStream {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as NodeJS.ReadableStream).on === "function"
  );
}

async function asBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (isUint8Array(body)) return Buffer.from(body);

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

  if (!isReadableStream(body)) throw new Error("S3 GetObject body is not a readable stream");

  return new Promise<Buffer>((resolve, reject) => {
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

// ---------------------------------------------------------------------------
// Document / special-format → image pre-rasterization
// ---------------------------------------------------------------------------

/**
 * HEIC/HEIF → JPEG buffer using heic-convert (libheif-js WASM).
 *
 * Sharp's bundled libheif is compiled without the HEVC (libde265) decoder
 * plugin, producing error 11.6003. heic-convert ships libheif-js which
 * bundles the full codec set as WASM, so it works in Lambda without any
 * system-level dependencies.
 */
async function heicToBuffer(buf: Buffer): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const convert = require("heic-convert") as (opts: {
    buffer: Buffer;
    format: "JPEG" | "PNG";
    quality?: number;
  }) => Promise<Buffer | ArrayBuffer>;
  const result = await convert({ buffer: buf, format: "JPEG", quality: 1 });
  return Buffer.isBuffer(result) ? result : Buffer.from(result as ArrayBuffer);
}

/**
 * PDF page 0 → PNG buffer using mupdf (WASM).
 *
 * pdfjs-dist requires a NodeCanvasFactory to render in Node.js; without it
 * the default factory silently returns blank canvases. mupdf handles all
 * font/image rendering internally (embedded in WASM), is more reliable,
 * and is ~200 MB smaller than pdfjs-dist when unpacked.
 */
async function pdfToImageBuffer(buf: Buffer): Promise<Buffer> {
  type MuPDFPixmap = { asPNG(): Uint8Array; destroy(): void };
  type MuPDFPage  = {
    toPixmap(matrix: number[], cs: unknown, alpha: boolean, annots: boolean): MuPDFPixmap;
    destroy(): void;
  };
  type MuPDFDoc   = { loadPage(n: number): MuPDFPage; destroy(): void };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mupdf = require("mupdf") as {
    Document: { openDocument(data: Uint8Array, mime: string): MuPDFDoc };
    ColorSpace: { DeviceRGB: unknown };
  };

  const doc     = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  const page    = doc.loadPage(0); // 0-indexed; first page
  // 2× scale ≈ 144 DPI for a typical letter/A4 page
  const pixmap  = page.toPixmap([2, 0, 0, 2, 0, 0], mupdf.ColorSpace.DeviceRGB, false, true);
  const pngBytes = pixmap.asPNG();
  pixmap.destroy();
  page.destroy();
  doc.destroy();
  return Buffer.from(pngBytes);
}

/**
 * PDF → DOCX buffer using pdf2docx (Python, called via child_process).
 *
 * pdf2docx preserves text, tables, images, and multi-column layouts for
 * text-based PDFs. For scanned PDFs it embeds rasterised pages as images so
 * the document is visually faithful even without OCR.
 */
async function pdfToDocxBuffer(buf: Buffer): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execFileSync } = require("child_process") as typeof import("child_process");

  const id = `pdf2docx-${Date.now()}-${process.pid}`;
  const inPath  = path.join(os.tmpdir(), `${id}.pdf`);
  const outPath = path.join(os.tmpdir(), `${id}.docx`);

  try {
    fs.writeFileSync(inPath, buf);
    execFileSync("python3", ["/var/task/pdf_to_docx.py", inPath, outPath], {
      timeout: 90_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = fs.readFileSync(outPath);
    if (!result || result.length === 0) throw new Error("pdf2docx produced an empty output file");
    return result;
  } finally {
    try { fs.unlinkSync(inPath); } catch { /* ignore */ }
    try { fs.unlinkSync(outPath); } catch { /* ignore */ }
  }
}

/**
 * DOCX → PDF buffer using mammoth (DOCX→HTML) + WeasyPrint (HTML→PDF, Python).
 *
 * mammoth converts DOCX to semantic HTML preserving headings, paragraphs, tables,
 * and embedded images. WeasyPrint renders the HTML to a paginated PDF using
 * Pango/Cairo (system libraries installed in the Lambda container image).
 */
async function docxToPdfBuffer(buf: Buffer): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execFileSync } = require("child_process") as typeof import("child_process");

  const id = `docx2pdf-${Date.now()}-${process.pid}`;
  const inPath  = path.join(os.tmpdir(), `${id}.docx`);
  const outPath = path.join(os.tmpdir(), `${id}.pdf`);

  try {
    fs.writeFileSync(inPath, buf);
    execFileSync("python3", ["/var/task/docx_to_pdf.py", inPath, outPath], {
      timeout: 90_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = fs.readFileSync(outPath);
    if (!result || result.length === 0) throw new Error("docx_to_pdf produced an empty output file");
    return result;
  } finally {
    try { fs.unlinkSync(inPath); } catch { /* ignore */ }
    try { fs.unlinkSync(outPath); } catch { /* ignore */ }
  }
}

/**
 * DOCX → PNG buffer using mammoth (text extraction) + @napi-rs/canvas.
 *
 * Lambda has no system fonts, so `ctx.font = "24px sans-serif"` resolves to
 * nothing and fillText() draws invisible text, producing a blank white image.
 * Fix: register the DejaVu font bundled in the container image and use it
 * explicitly. The Dockerfile copies DejaVuSans.ttf to /var/task/fonts/.
 */
async function docxToImageBuffer(buf: Buffer): Promise<Buffer> {
  type Ctx2D = {
    fillStyle: string;
    font: string;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
    measureText(text: string): { width: number };
  };
  type CanvasLike = { getContext(t: "2d"): Ctx2D; toBuffer(mime: string): Buffer };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas, GlobalFonts } = require("@napi-rs/canvas") as {
    createCanvas: (w: number, h: number) => CanvasLike;
    GlobalFonts: { registerFromPath(path: string, family: string): boolean };
  };

  // Register the DejaVu font bundled in the container (see Dockerfile).
  // This is idempotent — @napi-rs/canvas ignores duplicate registrations.
  GlobalFonts.registerFromPath("/var/task/fonts/DejaVuSans.ttf", "DocFont");

  const { value: text } = await mammoth.extractRawText({ buffer: buf });

  const W = 1240;
  const H = 1754; // A4-ish at 150 DPI
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const MARGIN = 80;
  const LINE_HEIGHT = 34;
  const MAX_WIDTH = W - MARGIN * 2;
  const MAX_Y = H - MARGIN;

  // Use the registered font instead of "sans-serif" which fails in Lambda
  ctx.font = "24px DocFont";
  ctx.fillStyle = "#1a1a1a";

  if (!text.trim()) {
    ctx.fillStyle = "#888888";
    ctx.font = "22px DocFont";
    ctx.fillText("(No extractable text content in this document)", MARGIN, MARGIN + LINE_HEIGHT * 2);
    return canvas.toBuffer("image/png");
  }

  let y = MARGIN + LINE_HEIGHT;
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());

  outer: for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > MAX_WIDTH && line) {
        ctx.fillText(line, MARGIN, y);
        y += LINE_HEIGHT;
        if (y > MAX_Y) break outer;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, MARGIN, y);
      y += LINE_HEIGHT;
      if (y > MAX_Y) break;
    }
    y += LINE_HEIGHT * 0.4; // paragraph gap
  }

  return canvas.toBuffer("image/png");
}

// ICO magic: bytes 0-3 = 00 00 01 00
function isIco(buf: Buffer): boolean {
  return buf.length >= 6 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0;
}

// PNG magic: bytes 0-3 = 89 50 4E 47
function isPng(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

// Extract the largest image frame from an ICO file.
// Modern ICOs store PNG-compressed frames; legacy ICOs store BMP/DIB frames.
function extractLargestIcoFrame(buf: Buffer): Buffer {
  const count = buf.readUInt16LE(4);
  let bestSize = -1;
  let bestOffset = -1;
  let bestLength = -1;

  for (let i = 0; i < count; i++) {
    const base = 6 + i * 16;
    if (base + 16 > buf.length) break;
    const w = buf[base] === 0 ? 256 : buf[base];
    const h = buf[base + 1] === 0 ? 256 : buf[base + 1];
    const size = w * h;
    const bytesInRes = buf.readUInt32LE(base + 8);
    const imageOffset = buf.readUInt32LE(base + 12);
    if (size > bestSize && imageOffset + bytesInRes <= buf.length) {
      bestSize = size;
      bestOffset = imageOffset;
      bestLength = bytesInRes;
    }
  }

  if (bestOffset < 0) throw new Error("ICO file contains no valid image frames");

  const frame = buf.subarray(bestOffset, bestOffset + bestLength);

  // PNG-compressed frame: pass directly to sharp
  if (isPng(frame)) return frame;

  // BMP/DIB frame: prepend the 14-byte BMP file header so sharp can read it
  // ICO DIB stores imageHeight * 2 (includes AND mask); fix it before wrapping
  if (frame.length < 40) throw new Error("ICO BMP frame too small to be a valid DIB header");

  const dibWidth = frame.readInt32LE(4);
  const dibHeight = frame.readInt32LE(8); // doubled in ICO
  const bmpBuf = Buffer.alloc(14 + frame.length);

  // BMP file header
  bmpBuf.write("BM", 0, "ascii");
  bmpBuf.writeUInt32LE(bmpBuf.length, 2);
  bmpBuf.writeUInt16LE(0, 6);
  bmpBuf.writeUInt16LE(0, 8);
  bmpBuf.writeUInt32LE(14, 10); // pixel data offset (simplified; may need adjustment for palettes)

  // Copy DIB, then fix height back to real value
  frame.copy(bmpBuf, 14);
  bmpBuf.writeInt32LE(Math.abs(dibHeight) / 2, 14 + 8);

  // Validate dimensions are reasonable
  if (Math.abs(dibWidth) === 0 || Math.abs(dibHeight) === 0) {
    throw new Error("ICO BMP frame has zero dimensions; cannot convert");
  }

  return bmpBuf;
}

async function preprocessInput(buf: Buffer): Promise<Buffer> {
  if (isIco(buf)) {
    return extractLargestIcoFrame(buf);
  }
  return buf;
}

async function applyConversion(
  rawBuf: Buffer,
  fmt: ImageOutputFormat,
  quality: number | null,
  resizePct: number | null,
  config: PresetConfig
): Promise<Buffer> {
  const inputBuf = await preprocessInput(rawBuf);

  let pipeline = sharp(inputBuf, { failOn: "none" });

  // Resize: explicit resizePct takes priority over preset maxWidth
  if (typeof resizePct === "number" && resizePct < 100) {
    const meta = await sharp(inputBuf).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;
    if (origW > 0 && origH > 0) {
      const newW = Math.max(1, Math.round(origW * resizePct / 100));
      const newH = Math.max(1, Math.round(origH * resizePct / 100));
      pipeline = pipeline.resize(newW, newH, { fit: "fill" });
    }
  } else if (config.maxWidth) {
    pipeline = pipeline.resize({ width: config.maxWidth, withoutEnlargement: true });
  }

  switch (fmt) {
    case "PNG":
      pipeline = pipeline.png({ compressionLevel: config.pngCompressionLevel });
      break;
    case "JPG": {
      const jpegQ = typeof quality === "number" && Number.isFinite(quality)
        ? Math.max(1, Math.min(100, Math.floor(quality))) : config.jpegQuality;
      pipeline = pipeline.jpeg({
        quality: jpegQ,
        progressive: config.jpegProgressive,
        chromaSubsampling: config.jpegChromaSubsampling,
        mozjpeg: true,
      });
      break;
    }
    case "WebP": {
      const webpQ = typeof quality === "number" && Number.isFinite(quality)
        ? Math.max(1, Math.min(100, Math.floor(quality))) : config.webpQuality;
      pipeline = pipeline.webp({ quality: webpQ });
      break;
    }
    case "GIF":
      pipeline = pipeline.gif();
      break;
    case "TIFF": {
      const tiffQ = typeof quality === "number" && Number.isFinite(quality)
        ? Math.max(1, Math.min(100, Math.floor(quality))) : config.tiffQuality;
      pipeline = pipeline.tiff({ quality: tiffQ });
      break;
    }
    case "AVIF": {
      const avifQ = typeof quality === "number" && Number.isFinite(quality)
        ? Math.max(1, Math.min(100, Math.floor(quality))) : config.webpQuality;
      pipeline = pipeline.avif({ quality: avifQ });
      break;
    }
  }

  return pipeline.toBuffer();
}

async function updateOutputRow(args: {
  pk: string;
  sk: string;
  status: "done" | "failed";
  bucket?: string;
  outputKey?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  errorMessage?: string | null;
}) {
  const updatedAt = new Date().toISOString();

  // Always alias reserved words used in the expression
  const names: Record<string, string> = { "#s": "status" };
  const values: Record<string, unknown> = {
    ":s": args.status,
    ":u": updatedAt,
  };
  const setParts: string[] = ["#s = :s", "updatedAt = :u"];

  if (args.bucket !== undefined) {
    // "bucket" is a DynamoDB reserved word — must alias it
    names["#bucket"] = "bucket";
    values[":b"] = args.bucket;
    setParts.push("#bucket = :b");
  }
  if (args.outputKey !== undefined) {
    // "key" is a DynamoDB reserved word — must alias it
    names["#key"] = "key";
    values[":k"] = args.outputKey;
    setParts.push("#key = :k");
  }
  if (args.filename !== undefined) {
    values[":fn"] = args.filename;
    setParts.push("filename = :fn");
  }
  if (args.contentType !== undefined) {
    values[":ct"] = args.contentType;
    setParts.push("contentType = :ct");
  }
  if (args.sizeBytes !== undefined) {
    values[":sz"] = args.sizeBytes;
    setParts.push("sizeBytes = :sz");
  }
  if (args.errorMessage !== undefined) {
    values[":em"] = args.errorMessage ?? null;
    setParts.push("errorMessage = :em");
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: args.pk, SK: args.sk },
      UpdateExpression: `SET ${setParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function handler(event: ConvertEvent): Promise<{ ok: boolean; error?: string }> {
  const { userSub, projectId, sourceFileId, outputFileId, outputFormat, quality, preset, resizePct } = event;

  const PK = `USER#${userSub}`;
  const outSK = `FILE#${projectId}#${outputFileId}`;

  const validFormats: OutputFormat[] = ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF", "DOCX", "PDF"];
  if (!validFormats.includes(outputFormat)) {
    await updateOutputRow({
      pk: PK,
      sk: outSK,
      status: "failed",
      errorMessage: `Unsupported format: ${String(outputFormat)}`,
    });
    return { ok: false, error: "unsupported_format" };
  }

  try {
    // 1. Look up the source (raw) file in DynamoDB to get its S3 location
    const srcSK = `FILE#${projectId}#${sourceFileId}`;
    const srcRes = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK: srcSK } })
    );

    const src = srcRes.Item;
    if (!src || !src.bucket || !src.key || !src.filename) {
      throw new Error(`Source file not found in DynamoDB: ${srcSK}`);
    }

    const srcBucket = String(src.bucket);
    const srcKey = String(src.key);
    const srcFilename = String(src.filename);
    const srcContentType = String(src.contentType || "").toLowerCase();

    // 2. Compute output filename and S3 key (same formula used by the convert API route)
    const outputFilename = replaceExt(srcFilename, extForFormat(outputFormat));
    const outputKey = `private/${userSub}/${projectId}/output/${outputFileId}/${outputFilename}`;
    const contentType = contentTypeFor(outputFormat);
    const config = presetConfig(preset);

    // 3. Download the raw file from S3
    const getRes = await s3.send(
      new GetObjectCommand({ Bucket: srcBucket, Key: srcKey })
    );
    const rawBuf = await asBuffer(getRes.Body);

    // 3b & 4. Convert — branch on output format first.
    const srcFilenameLow = srcFilename.toLowerCase();
    const srcIsPdf = srcContentType.includes("pdf") || srcFilenameLow.endsWith(".pdf");

    let outputBuf: Buffer;
    if (outputFormat === "DOCX") {
      // PDF → DOCX: layout-preserving document conversion via pdf2docx (Python).
      if (!srcIsPdf) {
        throw new Error(
          `DOCX output is only supported for PDF input (received content-type: ${srcContentType})`
        );
      }
      outputBuf = await pdfToDocxBuffer(rawBuf);
    } else if (outputFormat === "PDF") {
      // DOCX → PDF: mammoth (DOCX→HTML) + WeasyPrint (HTML→PDF) via Python subprocess.
      const srcIsDocx =
        srcContentType.includes("wordprocessingml") ||
        srcContentType.includes("msword") ||
        srcFilenameLow.endsWith(".docx") ||
        srcFilenameLow.endsWith(".doc");
      if (!srcIsDocx) {
        throw new Error(
          `PDF output is only supported for DOCX input (received content-type: ${srcContentType})`
        );
      }
      outputBuf = await docxToPdfBuffer(rawBuf);
    } else {
      // Image output: optionally pre-rasterize special input types, then run Sharp.
      let inputBuf: Buffer;
      if (
        srcContentType.includes("heic") ||
        srcContentType.includes("heif") ||
        srcFilenameLow.endsWith(".heic") ||
        srcFilenameLow.endsWith(".heif")
      ) {
        inputBuf = await heicToBuffer(rawBuf);
      } else if (srcIsPdf) {
        inputBuf = await pdfToImageBuffer(rawBuf);
      } else if (
        srcContentType.includes("wordprocessingml") ||
        srcContentType.includes("msword") ||
        srcFilenameLow.endsWith(".docx") ||
        srcFilenameLow.endsWith(".doc")
      ) {
        inputBuf = await docxToImageBuffer(rawBuf);
      } else {
        inputBuf = rawBuf;
      }
      outputBuf = await applyConversion(inputBuf, outputFormat, quality, resizePct, config);
    }

    // 5. Upload converted file to OUTPUT_BUCKET
    await s3.send(
      new PutObjectCommand({
        Bucket: OUTPUT_BUCKET,
        Key: outputKey,
        Body: outputBuf,
        ContentType: contentType,
      })
    );

    // 6. Mark output row as done with real file info
    await updateOutputRow({
      pk: PK,
      sk: outSK,
      status: "done",
      bucket: OUTPUT_BUCKET,
      outputKey,
      filename: outputFilename,
      contentType,
      sizeBytes: outputBuf.byteLength,
      errorMessage: null,
    });

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "conversion failed";
    await updateOutputRow({
      pk: PK,
      sk: outSK,
      status: "failed",
      errorMessage: msg,
    });
    // Rethrow so Step Functions marks the execution as FAILED (enables retry on transient errors)
    throw err;
  }
}
