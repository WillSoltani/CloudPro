// infra/lib/lambdas/convert-worker/index.ts
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import sharp from "sharp";

type OutputFormat = "PNG" | "JPG" | "WebP" | "GIF" | "TIFF" | "AVIF" | "BMP" | "ICO" | "SVG" | "PDF";
type ImageOutputFormat = Exclude<OutputFormat, "PDF">;
type RasterImageOutputFormat = Extract<OutputFormat, "PNG" | "JPG" | "WebP">;
type OutputPackaging = "single" | "zip";
type SourceDocExt = "pdf" | "docx" | "doc";
type SourceKind = "pdf" | "docx" | "pages" | "image";
type SourceImageKind =
  | "png"
  | "jpeg"
  | "webp"
  | "gif"
  | "tiff"
  | "avif"
  | "heic"
  | "heif"
  | "bmp"
  | "svg"
  | "ico"
  | "unknown";

type SourceInfo = {
  kind: SourceKind;
  imageKind: SourceImageKind;
  mime: string;
};

type PagesPdfMeta = {
  converter: string;
  sourceEntry: string;
  pageCount: number;
};

type DocxSanitizationMeta = {
  applied: boolean;
  normalizedSections: number;
  normalizedParagraphSections: number;
  normalizedBodySections: number;
  inconsistentColumns: boolean;
  minColumnWidthSeenTwips: number | null;
  strategy: string;
};

type CanonicalPdfMeta = {
  converter: string;
  libreofficeVersion: string;
  pageCount: number;
  nonBlankPages: number;
  narrowTextPages: number[];
  conversionStrategy: string;
  sanitization: DocxSanitizationMeta;
};

type CanonicalPdfResult = {
  pdfBuffer: Buffer;
  meta: CanonicalPdfMeta;
};

type ImageZipFidelity = {
  threshold: number;
  maxMae: number;
  avgMae: number;
};

type DocumentImageZipResult = {
  zipBuffer: Buffer;
  pageCount: number;
  fidelity?: ImageZipFidelity;
};

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
    BMP: "bmp",
    ICO: "ico",
    SVG: "svg",
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
    BMP: "image/bmp",
    ICO: "image/x-icon",
    SVG: "image/svg+xml",
    PDF: "application/pdf",
  };
  return map[fmt];
}

function replaceExt(filename: string, ext: string): string {
  const dot = filename.lastIndexOf(".");
  return (dot < 0 ? filename : filename.slice(0, dot)) + "." + ext;
}

function stripExt(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? filename : filename.slice(0, dot);
}

function isRasterImageFormat(fmt: OutputFormat): fmt is RasterImageOutputFormat {
  return fmt === "PNG" || fmt === "JPG" || fmt === "WebP";
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

const SVG_SCAN_MAX_BYTES = 1024 * 1024;
const SVG_DEFAULT_DENSITY = 192;
const NORMALIZED_PNG_COMPRESSION = 6;

function startsWithBytes(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[i] !== bytes[i]) return false;
  }
  return true;
}

function extFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

function sniffIsoBmffKind(buf: Buffer): SourceImageKind | null {
  if (buf.length < 16) return null;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return null;
  const brands = buf.toString("ascii", 8, Math.min(buf.length, 64)).toLowerCase();
  if (brands.includes("avif") || brands.includes("avis")) return "avif";
  if (
    brands.includes("heic") ||
    brands.includes("heix") ||
    brands.includes("hevc") ||
    brands.includes("hevx") ||
    brands.includes("heim") ||
    brands.includes("heis")
  ) {
    return "heic";
  }
  if (brands.includes("heif") || brands.includes("mif1") || brands.includes("msf1")) return "heif";
  return null;
}

function looksLikeSvg(buf: Buffer): boolean {
  const snippet = buf.subarray(0, Math.min(buf.length, SVG_SCAN_MAX_BYTES)).toString("utf8");
  const trimmed = snippet.replace(/^\uFEFF/, "").trimStart();
  if (!trimmed) return false;
  if (/^<svg[\s>]/i.test(trimmed)) return true;
  if (/^<\?xml[\s\S]{0,2048}<svg[\s>]/i.test(trimmed)) return true;
  return /<svg[\s>]/i.test(trimmed.slice(0, 4096));
}

function mimeForImageKind(kind: SourceImageKind): string {
  switch (kind) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "tiff":
      return "image/tiff";
    case "avif":
      return "image/avif";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function imageKindFromDeclaredOrFilename(declaredCt: string, filename: string): SourceImageKind {
  const ct = declaredCt.toLowerCase();
  const ext = extFromFilename(filename);
  if (ct.includes("png") || ext === "png") return "png";
  if (ct.includes("jpeg") || ct.includes("jpg") || ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ct.includes("webp") || ext === "webp") return "webp";
  if (ct.includes("gif") || ext === "gif") return "gif";
  if (ct.includes("tiff") || ext === "tif" || ext === "tiff") return "tiff";
  if (ct.includes("avif") || ext === "avif") return "avif";
  if (ct.includes("heic") || ext === "heic") return "heic";
  if (ct.includes("heif") || ext === "heif") return "heif";
  if (ct.includes("bmp") || ext === "bmp") return "bmp";
  if (ct.includes("svg") || ext === "svg") return "svg";
  if (ct.includes("x-icon") || ct.includes("vnd.microsoft.icon") || ext === "ico") return "ico";
  return "unknown";
}

function looksLikeDocxZip(buf: Buffer): boolean {
  if (!startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04])) return false;
  const probe = buf.subarray(0, Math.min(buf.length, 512 * 1024)).toString("utf8");
  return (
    probe.includes("word/document.xml") ||
    probe.includes("word/") ||
    probe.includes("[Content_Types].xml")
  );
}

function looksLikePagesZip(buf: Buffer, filename: string, declaredCt: string): boolean {
  if (!startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04])) return false;
  if (
    filename.endsWith(".pages") ||
    declaredCt.includes("apple.pages") ||
    declaredCt.includes("iwork-pages")
  ) {
    return true;
  }
  const probe = buf.subarray(0, Math.min(buf.length, 512 * 1024)).toString("utf8").toLowerCase();
  return (
    probe.includes("index/document.iwa") ||
    probe.includes("metadata/buildversionhistory.plist") ||
    probe.includes("quicklook/preview.pdf")
  );
}

function detectSourceInfo(rawBuf: Buffer, srcFilename: string, srcContentType: string): SourceInfo {
  const filename = srcFilename.toLowerCase();
  const declaredCt = (srcContentType || "").toLowerCase();

  if (startsWithBytes(rawBuf, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { kind: "pdf", imageKind: "unknown", mime: "application/pdf" };
  }

  if (looksLikePagesZip(rawBuf, filename, declaredCt)) {
    return { kind: "pages", imageKind: "unknown", mime: "application/vnd.apple.pages" };
  }

  if (looksLikeDocxZip(rawBuf)) {
    const mime = filename.endsWith(".doc")
      ? "application/msword"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return { kind: "docx", imageKind: "unknown", mime };
  }

  if (startsWithBytes(rawBuf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { kind: "docx", imageKind: "unknown", mime: "application/msword" };
  }

  let imageKind: SourceImageKind = "unknown";
  if (startsWithBytes(rawBuf, [0x89, 0x50, 0x4e, 0x47])) imageKind = "png";
  else if (startsWithBytes(rawBuf, [0xff, 0xd8, 0xff])) imageKind = "jpeg";
  else if (
    rawBuf.length >= 12 &&
    rawBuf.toString("ascii", 0, 4) === "RIFF" &&
    rawBuf.toString("ascii", 8, 12) === "WEBP"
  ) {
    imageKind = "webp";
  } else if (startsWithBytes(rawBuf, [0x47, 0x49, 0x46, 0x38])) {
    imageKind = "gif";
  } else if (
    startsWithBytes(rawBuf, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWithBytes(rawBuf, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    imageKind = "tiff";
  } else if (startsWithBytes(rawBuf, [0x00, 0x00, 0x01, 0x00])) {
    imageKind = "ico";
  } else if (startsWithBytes(rawBuf, [0x42, 0x4d])) {
    imageKind = "bmp";
  } else {
    const bmffKind = sniffIsoBmffKind(rawBuf);
    if (bmffKind) imageKind = bmffKind;
    else if (looksLikeSvg(rawBuf)) imageKind = "svg";
    else imageKind = imageKindFromDeclaredOrFilename(declaredCt, filename);
  }

  // Extension/content-type fallback for document inputs if magic bytes were ambiguous.
  if (
    imageKind === "unknown" &&
    (declaredCt.includes("pdf") || filename.endsWith(".pdf"))
  ) {
    return { kind: "pdf", imageKind: "unknown", mime: "application/pdf" };
  }
  if (
    imageKind === "unknown" &&
    (declaredCt.includes("apple.pages") ||
      declaredCt.includes("iwork-pages") ||
      filename.endsWith(".pages"))
  ) {
    return { kind: "pages", imageKind: "unknown", mime: "application/vnd.apple.pages" };
  }
  if (
    imageKind === "unknown" &&
    (declaredCt.includes("wordprocessingml") ||
      declaredCt.includes("msword") ||
      filename.endsWith(".docx") ||
      filename.endsWith(".doc"))
  ) {
    const mime = filename.endsWith(".doc")
      ? "application/msword"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return { kind: "docx", imageKind: "unknown", mime };
  }

  return {
    kind: "image",
    imageKind,
    mime: imageKind === "unknown" ? (declaredCt || "application/octet-stream") : mimeForImageKind(imageKind),
  };
}

function allowedOutputsForSourceInfo(sourceInfo: SourceInfo): OutputFormat[] {
  if (sourceInfo.kind === "pdf") return ["PNG", "JPG", "WebP"];
  if (sourceInfo.kind === "docx") return ["PNG", "JPG", "WebP", "PDF"];
  if (sourceInfo.kind === "pages") return ["PNG", "JPG", "WebP", "PDF"];
  if (sourceInfo.imageKind === "ico") {
    return ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF", "BMP", "ICO", "PDF"];
  }
  return ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF", "BMP", "ICO", "SVG", "PDF"];
}

function assertSafeSvg(buf: Buffer): void {
  const snippet = buf.subarray(0, Math.min(buf.length, SVG_SCAN_MAX_BYTES)).toString("utf8");
  const trimmed = snippet.replace(/^\uFEFF/, "").trimStart();
  if (!/<svg[\s>]/i.test(trimmed)) {
    throw new Error("SVG input is invalid (missing <svg> root element)");
  }

  const blockedPatterns: Array<[RegExp, string]> = [
    [/\b(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|file:)/i, "external href reference"],
    [/\bsrc\s*=\s*["']\s*(?:https?:|\/\/|file:)/i, "external src reference"],
    [/@import\s+url\(\s*['"]?(?:https?:|\/\/|file:)/i, "external CSS import"],
    [/<!DOCTYPE/i, "DOCTYPE declarations are blocked for SVG security"],
    [/<!ENTITY/i, "XML entities are blocked for SVG security"],
  ];
  for (const [pattern, reason] of blockedPatterns) {
    if (pattern.test(trimmed)) {
      throw new Error(`SVG contains unsupported ${reason}`);
    }
  }
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

function parseLastJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith("{") || !line.endsWith("}")) continue;
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      // ignore non-JSON lines
    }
  }
  return null;
}

function runPythonScript(
  scriptPath: string,
  args: string[],
  timeoutMs: number,
  label: string
): { stdout: string; stderr: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawnSync } = require("child_process") as typeof import("child_process");
  const result = spawnSync("python3", [scriptPath, ...args], {
    timeout: timeoutMs,
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  if (result.status !== 0) {
    const structured = parseLastJsonObject(stderr) ?? parseLastJsonObject(stdout);
    if (structured) throw new Error(`${label} failed: ${JSON.stringify(structured)}`);
    const details = [stderr, stdout].filter(Boolean).join(" | ");
    const suffix = details ? `: ${details.slice(0, 900)}` : "";
    throw new Error(`${label} failed${suffix}`);
  }
  return { stdout, stderr };
}

/**
 * Convert PDF/DOCX to per-page images in a ZIP artifact.
 */
async function documentToImagesZip(args: {
  buf: Buffer;
  sourceExt: SourceDocExt;
  sourceFilename: string;
  outputFormat: RasterImageOutputFormat;
  quality: number;
  resizePct: number | null;
  maxWidth: number | undefined;
}): Promise<DocumentImageZipResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");

  const id = `doc2img-${Date.now()}-${process.pid}`;
  const inPath = path.join(os.tmpdir(), `${id}.${args.sourceExt}`);
  const outZipPath = path.join(os.tmpdir(), `${id}.zip`);
  const baseName = stripExt(args.sourceFilename) || "document";
  const resize = typeof args.resizePct === "number" ? Math.max(10, Math.min(100, Math.floor(args.resizePct))) : 100;
  const maxWidth = resize < 100 ? 0 : Math.max(0, Math.floor(args.maxWidth ?? 0));
  const fmtLower = args.outputFormat.toLowerCase();

  try {
    fs.writeFileSync(inPath, args.buf);
    const run = runPythonScript(
      "/var/task/document_to_images_zip.py",
      [
        inPath,
        outZipPath,
        baseName,
        fmtLower,
        "160", // consistent rasterization quality while keeping memory reasonable
        String(Math.max(1, Math.min(100, Math.floor(args.quality)))),
        String(resize),
        String(maxWidth),
      ],
      120_000,
      "Document image rendering"
    );
    const result = fs.readFileSync(outZipPath);
    if (!result || result.length === 0) {
      throw new Error("Document image rendering produced an empty ZIP output file");
    }
    const meta = parseLastJsonObject(run.stdout) ?? parseLastJsonObject(run.stderr);
    const pagesRaw = meta?.pages;
    const pageCount =
      typeof pagesRaw === "number" && Number.isFinite(pagesRaw) && pagesRaw > 0
        ? Math.floor(pagesRaw)
        : 0;
    if (pageCount <= 0) {
      throw new Error("Document image rendering did not report a valid page count");
    }
    const fidelityRaw = meta?.fidelity;
    let fidelity: ImageZipFidelity | undefined;
    if (typeof fidelityRaw === "object" && fidelityRaw !== null) {
      const obj = fidelityRaw as Record<string, unknown>;
      const threshold = obj.threshold;
      const maxMae = obj.max_mae;
      const avgMae = obj.avg_mae;
      if (
        typeof threshold === "number" && Number.isFinite(threshold) &&
        typeof maxMae === "number" && Number.isFinite(maxMae) &&
        typeof avgMae === "number" && Number.isFinite(avgMae)
      ) {
        fidelity = { threshold, maxMae, avgMae };
      }
    }
    return { zipBuffer: result, pageCount, fidelity };
  } finally {
    try { fs.unlinkSync(inPath); } catch { /* ignore */ }
    try { fs.unlinkSync(outZipPath); } catch { /* ignore */ }
  }
}

/**
 * DOCX → canonical PDF via LibreOffice.
 */
async function docxToCanonicalPdf(buf: Buffer): Promise<CanonicalPdfResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  const id = `docx2pdf-${Date.now()}-${process.pid}`;
  const inPath  = path.join(os.tmpdir(), `${id}.docx`);
  const outPath = path.join(os.tmpdir(), `${id}.pdf`);

  try {
    fs.writeFileSync(inPath, buf);
    const run = runPythonScript("/var/task/docx_to_pdf.py", [inPath, outPath], 120_000, "DOCX→PDF conversion");
    const result = fs.readFileSync(outPath);
    if (!result || result.length === 0) throw new Error("docx_to_pdf produced an empty output file");
    const meta = parseLastJsonObject(run.stdout) ?? parseLastJsonObject(run.stderr) ?? {};
    const converter = typeof meta.converter === "string" ? meta.converter : "libreoffice";
    const libreofficeVersion =
      typeof meta.libreoffice_version === "string" ? meta.libreoffice_version : "unknown";
    const pageCount =
      typeof meta.page_count === "number" && Number.isFinite(meta.page_count)
        ? Math.max(0, Math.floor(meta.page_count))
        : 0;
    const nonBlankPages =
      typeof meta.non_blank_pages === "number" && Number.isFinite(meta.non_blank_pages)
        ? Math.max(0, Math.floor(meta.non_blank_pages))
        : 0;
    const narrowTextPagesRaw = meta.narrow_text_pages;
    const narrowTextPages =
      Array.isArray(narrowTextPagesRaw)
        ? narrowTextPagesRaw
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
            .map((v) => Math.floor(v))
        : [];
    const conversionStrategy =
      typeof meta.conversion_strategy === "string" ? meta.conversion_strategy : "baseline";
    const sanitizeRaw = meta.sanitization;
    let sanitization: DocxSanitizationMeta = {
      applied: false,
      normalizedSections: 0,
      normalizedParagraphSections: 0,
      normalizedBodySections: 0,
      inconsistentColumns: false,
      minColumnWidthSeenTwips: null,
      strategy: "baseline",
    };
    if (typeof sanitizeRaw === "object" && sanitizeRaw !== null) {
      const obj = sanitizeRaw as Record<string, unknown>;
      sanitization = {
        applied: obj.applied === true,
        normalizedSections:
          typeof obj.normalized_sections === "number" && Number.isFinite(obj.normalized_sections)
            ? Math.max(0, Math.floor(obj.normalized_sections))
            : 0,
        normalizedParagraphSections:
          typeof obj.normalized_paragraph_sections === "number" && Number.isFinite(obj.normalized_paragraph_sections)
            ? Math.max(0, Math.floor(obj.normalized_paragraph_sections))
            : 0,
        normalizedBodySections:
          typeof obj.normalized_body_sections === "number" && Number.isFinite(obj.normalized_body_sections)
            ? Math.max(0, Math.floor(obj.normalized_body_sections))
            : 0,
        inconsistentColumns: obj.inconsistent_columns === true,
        minColumnWidthSeenTwips:
          typeof obj.min_column_width_seen_twips === "number" && Number.isFinite(obj.min_column_width_seen_twips)
            ? Math.max(0, Math.floor(obj.min_column_width_seen_twips))
            : null,
        strategy: typeof obj.strategy === "string" ? obj.strategy : conversionStrategy,
      };
    }
    return {
      pdfBuffer: result,
      meta: {
        converter,
        libreofficeVersion,
        pageCount,
        nonBlankPages,
        narrowTextPages,
        conversionStrategy,
        sanitization,
      },
    };
  } finally {
    try { fs.unlinkSync(inPath); } catch { /* ignore */ }
    try { fs.unlinkSync(outPath); } catch { /* ignore */ }
  }
}

async function pagesToCanonicalPdf(buf: Buffer): Promise<{ pdfBuffer: Buffer; meta: PagesPdfMeta }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  const id = `pages2pdf-${Date.now()}-${process.pid}`;
  const inPath = path.join(os.tmpdir(), `${id}.pages`);
  const outPath = path.join(os.tmpdir(), `${id}.pdf`);

  try {
    fs.writeFileSync(inPath, buf);
    const run = runPythonScript(
      "/var/task/pages_to_pdf.py",
      [inPath, outPath],
      120_000,
      "PAGES→PDF conversion"
    );
    const result = fs.readFileSync(outPath);
    if (!result || result.length === 0) throw new Error("pages_to_pdf produced an empty output file");
    const meta = parseLastJsonObject(run.stdout) ?? parseLastJsonObject(run.stderr) ?? {};
    const converter = typeof meta.converter === "string" ? meta.converter : "pages_preview";
    const sourceEntry = typeof meta.source_entry === "string" ? meta.source_entry : "QuickLook/Preview.pdf";
    const pageCount =
      typeof meta.page_count === "number" && Number.isFinite(meta.page_count)
        ? Math.max(0, Math.floor(meta.page_count))
        : 0;
    return {
      pdfBuffer: result,
      meta: {
        converter,
        sourceEntry,
        pageCount,
      },
    };
  } finally {
    try { fs.unlinkSync(inPath); } catch { /* ignore */ }
    try { fs.unlinkSync(outPath); } catch { /* ignore */ }
  }
}

async function imageToPdfBuffer(args: {
  rawBuf: Buffer;
  sourceInfo: SourceInfo;
  resizePct: number | null;
  maxWidth: number | undefined;
}): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  const id = `img2pdf-${Date.now()}-${process.pid}`;
  const inPath = path.join(os.tmpdir(), `${id}.png`);
  const outPath = path.join(os.tmpdir(), `${id}.pdf`);

  try {
    const preprocessed = await preprocessInput({
      buf: args.rawBuf,
      sourceInfo: args.sourceInfo,
    });
    // Normalize to PNG before Python conversion for consistent decoder behavior.
    const normalizedPng = await renderNormalizedPng({
      inputBuf: preprocessed,
      sourceInfo: args.sourceInfo,
      resizePct: args.resizePct,
      maxWidth: args.maxWidth,
    });

    fs.writeFileSync(inPath, normalizedPng);
    runPythonScript("/var/task/image_to_pdf.py", [inPath, outPath], 60_000, "Image→PDF conversion");
    const result = fs.readFileSync(outPath);
    if (!result || result.length === 0) {
      throw new Error("Image→PDF conversion produced an empty output file");
    }
    return result;
  } finally {
    try { fs.unlinkSync(inPath); } catch { /* ignore */ }
    try { fs.unlinkSync(outPath); } catch { /* ignore */ }
  }
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

function sharpOptionsForSource(imageKind: SourceImageKind): { failOn: "none"; density?: number } {
  if (imageKind === "svg") {
    return { failOn: "none", density: SVG_DEFAULT_DENSITY };
  }
  return { failOn: "none" };
}

async function preprocessInput(args: { buf: Buffer; sourceInfo: SourceInfo }): Promise<Buffer> {
  const { buf, sourceInfo } = args;
  if (sourceInfo.imageKind === "svg") {
    assertSafeSvg(buf);
    return buf;
  }
  if (sourceInfo.imageKind === "ico" || isIco(buf)) {
    return extractLargestIcoFrame(buf);
  }
  if (sourceInfo.imageKind === "heic" || sourceInfo.imageKind === "heif") {
    return heicToBuffer(buf);
  }
  return buf;
}

async function applyResize(
  pipeline: sharp.Sharp,
  inputBuf: Buffer,
  sourceInfo: SourceInfo,
  resizePct: number | null,
  maxWidth: number | undefined
): Promise<sharp.Sharp> {
  if (typeof resizePct === "number" && resizePct < 100) {
    const meta = await sharp(inputBuf, sharpOptionsForSource(sourceInfo.imageKind)).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;
    if (origW > 0 && origH > 0) {
      const newW = Math.max(1, Math.round(origW * resizePct / 100));
      const newH = Math.max(1, Math.round(origH * resizePct / 100));
      return pipeline.resize(newW, newH, { fit: "fill" });
    }
    return pipeline;
  }
  if (maxWidth) {
    return pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  return pipeline;
}

async function renderNormalizedPng(args: {
  inputBuf: Buffer;
  sourceInfo: SourceInfo;
  resizePct: number | null;
  maxWidth: number | undefined;
}): Promise<Buffer> {
  let pipeline = sharp(args.inputBuf, sharpOptionsForSource(args.sourceInfo.imageKind));
  pipeline = await applyResize(pipeline, args.inputBuf, args.sourceInfo, args.resizePct, args.maxWidth);
  return pipeline.png({ compressionLevel: NORMALIZED_PNG_COMPRESSION }).toBuffer();
}

async function convertWithPythonSpecialEncoder(inputPng: Buffer, target: "ico" | "bmp"): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  const id = `img-special-${Date.now()}-${process.pid}`;
  const inPath = path.join(os.tmpdir(), `${id}.png`);
  const outPath = path.join(os.tmpdir(), `${id}.${target}`);

  try {
    fs.writeFileSync(inPath, inputPng);
    runPythonScript(
      "/var/task/image_special_convert.py",
      [inPath, outPath, target],
      60_000,
      `Image→${target.toUpperCase()} conversion`
    );
    const result = fs.readFileSync(outPath);
    if (!result || result.length === 0) {
      throw new Error(`Image→${target.toUpperCase()} conversion produced an empty output file`);
    }
    return result;
  } finally {
    try { fs.unlinkSync(inPath); } catch { /* ignore */ }
    try { fs.unlinkSync(outPath); } catch { /* ignore */ }
  }
}

function pngToEmbeddedSvg(pngBuf: Buffer, width: number, height: number): Buffer {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const b64 = pngBuf.toString("base64");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" version="1.1">` +
    `<image width="${w}" height="${h}" href="data:image/png;base64,${b64}"/>` +
    `</svg>\n`;
  return Buffer.from(xml, "utf8");
}

async function applyConversion(args: {
  rawBuf: Buffer;
  sourceInfo: SourceInfo;
  fmt: ImageOutputFormat;
  quality: number | null;
  resizePct: number | null;
  config: PresetConfig;
}): Promise<Buffer> {
  const inputBuf = await preprocessInput({
    buf: args.rawBuf,
    sourceInfo: args.sourceInfo,
  });

  if (args.fmt === "ICO" || args.fmt === "BMP" || args.fmt === "SVG") {
    const normalizedPng = await renderNormalizedPng({
      inputBuf,
      sourceInfo: args.sourceInfo,
      resizePct: args.resizePct,
      maxWidth: args.config.maxWidth,
    });
    if (args.fmt === "ICO") {
      return convertWithPythonSpecialEncoder(normalizedPng, "ico");
    }
    if (args.fmt === "BMP") {
      return convertWithPythonSpecialEncoder(normalizedPng, "bmp");
    }
    const meta = await sharp(normalizedPng, { failOn: "none" }).metadata();
    return pngToEmbeddedSvg(normalizedPng, meta.width ?? 1, meta.height ?? 1);
  }

  let pipeline = sharp(inputBuf, sharpOptionsForSource(args.sourceInfo.imageKind));
  pipeline = await applyResize(
    pipeline,
    inputBuf,
    args.sourceInfo,
    args.resizePct,
    args.config.maxWidth
  );

  switch (args.fmt) {
    case "PNG":
      pipeline = pipeline.png({ compressionLevel: args.config.pngCompressionLevel });
      break;
    case "JPG": {
      const jpegQ = typeof args.quality === "number" && Number.isFinite(args.quality)
        ? Math.max(1, Math.min(100, Math.floor(args.quality))) : args.config.jpegQuality;
      pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({
        quality: jpegQ,
        progressive: args.config.jpegProgressive,
        chromaSubsampling: args.config.jpegChromaSubsampling,
        mozjpeg: true,
      });
      break;
    }
    case "WebP": {
      const webpQ = typeof args.quality === "number" && Number.isFinite(args.quality)
        ? Math.max(1, Math.min(100, Math.floor(args.quality))) : args.config.webpQuality;
      pipeline = pipeline.webp({ quality: webpQ });
      break;
    }
    case "GIF":
      pipeline = pipeline.gif();
      break;
    case "TIFF": {
      const tiffQ = typeof args.quality === "number" && Number.isFinite(args.quality)
        ? Math.max(1, Math.min(100, Math.floor(args.quality))) : args.config.tiffQuality;
      pipeline = pipeline.tiff({ quality: tiffQ });
      break;
    }
    case "AVIF": {
      const avifQ = typeof args.quality === "number" && Number.isFinite(args.quality)
        ? Math.max(1, Math.min(100, Math.floor(args.quality))) : args.config.webpQuality;
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
  packaging?: OutputPackaging;
  pageCount?: number;
  outputCount?: number;
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
  if (args.packaging !== undefined) {
    values[":pkging"] = args.packaging;
    setParts.push("packaging = :pkging");
  }
  if (args.pageCount !== undefined) {
    values[":pages"] = args.pageCount;
    setParts.push("pageCount = :pages");
  }
  if (args.outputCount !== undefined) {
    values[":outCount"] = args.outputCount;
    setParts.push("outputCount = :outCount");
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

  const validFormats: OutputFormat[] = ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF", "BMP", "ICO", "SVG", "PDF"];
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

    const config = presetConfig(preset);

    // 3. Download the raw file from S3
    const getRes = await s3.send(
      new GetObjectCommand({ Bucket: srcBucket, Key: srcKey })
    );
    const rawBuf = await asBuffer(getRes.Body);

    // 3b. Detect source type by content, not only filename/content-type metadata.
    const sourceInfo = detectSourceInfo(rawBuf, srcFilename, srcContentType);
    const srcIsPdf = sourceInfo.kind === "pdf";
    const srcIsDocx = sourceInfo.kind === "docx";
    const srcIsPages = sourceInfo.kind === "pages";
    const allowedOutputs = allowedOutputsForSourceInfo(sourceInfo);

    if (sourceInfo.kind === "image" && sourceInfo.imageKind === "unknown") {
      throw new Error(
        `Unsupported or unrecognized source media type (declared content-type: ${srcContentType || "unknown"})`
      );
    }
    if (!allowedOutputs.includes(outputFormat)) {
      throw new Error(
        `Unsupported conversion for detected source type ${sourceInfo.kind}/${sourceInfo.imageKind}: ${outputFormat}`
      );
    }

    if (sourceInfo.mime && sourceInfo.mime !== srcContentType) {
      console.log(
        JSON.stringify({
          event: "source_mime_normalized",
          sourceFileId,
          declaredContentType: srcContentType || "unknown",
          detectedContentType: sourceInfo.mime,
          detectedKind: sourceInfo.kind,
          detectedImageKind: sourceInfo.imageKind,
        })
      );
    }

    if ((srcIsPdf || srcIsDocx || srcIsPages) && outputFormat !== "PDF" && !isRasterImageFormat(outputFormat)) {
      throw new Error(`For PDF/DOCX/PAGES image conversion, only PNG/JPG/WebP are supported (requested ${outputFormat})`);
    }

    let outputBuf: Buffer;
    let outputFilename = replaceExt(srcFilename, extForFormat(outputFormat));
    let contentType = contentTypeFor(outputFormat);
    let packaging: OutputPackaging = "single";
    let pageCount: number | undefined;
    let outputCount: number | undefined;
    let canonicalPdf: CanonicalPdfResult | undefined;
    let pagesCanonicalPdf: Buffer | undefined;
    let pagesCanonicalMeta: PagesPdfMeta | undefined;

    if (srcIsDocx) {
      canonicalPdf = await docxToCanonicalPdf(rawBuf);
      console.log(
        JSON.stringify({
          event: "docx_canonical_pdf_ready",
          sourceFileId,
          outputFileId,
          converter: canonicalPdf.meta.converter,
          libreofficeVersion: canonicalPdf.meta.libreofficeVersion,
          pageCount: canonicalPdf.meta.pageCount,
          nonBlankPages: canonicalPdf.meta.nonBlankPages,
          narrowTextPages: canonicalPdf.meta.narrowTextPages,
          conversionStrategy: canonicalPdf.meta.conversionStrategy,
          sanitizationApplied: canonicalPdf.meta.sanitization.applied,
          normalizedSections: canonicalPdf.meta.sanitization.normalizedSections,
          normalizedParagraphSections: canonicalPdf.meta.sanitization.normalizedParagraphSections,
          normalizedBodySections: canonicalPdf.meta.sanitization.normalizedBodySections,
          inconsistentColumns: canonicalPdf.meta.sanitization.inconsistentColumns,
          minColumnWidthSeenTwips: canonicalPdf.meta.sanitization.minColumnWidthSeenTwips,
          sanitizationStrategy: canonicalPdf.meta.sanitization.strategy,
        })
      );
    }
    if (srcIsPages) {
      const pages = await pagesToCanonicalPdf(rawBuf);
      pagesCanonicalPdf = pages.pdfBuffer;
      pagesCanonicalMeta = pages.meta;
      console.log(
        JSON.stringify({
          event: "pages_canonical_pdf_ready",
          sourceFileId,
          outputFileId,
          converter: pages.meta.converter,
          sourceEntry: pages.meta.sourceEntry,
          pageCount: pages.meta.pageCount,
        })
      );
    }

    if (outputFormat === "PDF") {
      if (srcIsDocx) {
        if (!canonicalPdf) {
          throw new Error("DOCX canonical PDF renderer did not produce a PDF");
        }
        outputBuf = canonicalPdf.pdfBuffer;
        pageCount = canonicalPdf.meta.pageCount;
        outputCount = canonicalPdf.meta.pageCount;
        console.log(
          JSON.stringify({
            event: "fidelity_metrics",
            sourceType: "DOCX",
            target: "PDF",
            engine: canonicalPdf.meta.converter,
            libreofficeVersion: canonicalPdf.meta.libreofficeVersion,
            pageCount: canonicalPdf.meta.pageCount,
            metric: "canonical_pdf_identity",
            maxMae: 0,
            avgMae: 0,
            threshold: 0,
          })
        );
      } else if (srcIsPages) {
        if (!pagesCanonicalPdf || !pagesCanonicalMeta) {
          throw new Error("PAGES canonical PDF renderer did not produce a PDF");
        }
        outputBuf = pagesCanonicalPdf;
        pageCount = pagesCanonicalMeta.pageCount;
        outputCount = pagesCanonicalMeta.pageCount;
      } else if (srcIsPdf) {
        throw new Error(
          `PDF output for PDF source is not supported (received content-type: ${sourceInfo.mime || srcContentType})`
        );
      } else {
        outputBuf = await imageToPdfBuffer({
          rawBuf,
          sourceInfo,
          resizePct,
          maxWidth: config.maxWidth,
        });
      }
    } else if ((srcIsPdf || srcIsDocx || srcIsPages) && isRasterImageFormat(outputFormat)) {
      const qualityForPages =
        outputFormat === "JPG"
          ? (typeof quality === "number" && Number.isFinite(quality)
              ? Math.max(1, Math.min(100, Math.floor(quality)))
              : config.jpegQuality)
          : outputFormat === "WebP"
            ? (typeof quality === "number" && Number.isFinite(quality)
                ? Math.max(1, Math.min(100, Math.floor(quality)))
                : config.webpQuality)
            : 90;
      const sourcePdfBuffer =
        srcIsDocx ? canonicalPdf?.pdfBuffer : srcIsPages ? pagesCanonicalPdf : rawBuf;
      if (!sourcePdfBuffer) {
        throw new Error("Document image rendering did not receive canonical PDF bytes");
      }
      const rendered = await documentToImagesZip({
        buf: sourcePdfBuffer,
        sourceExt: "pdf",
        sourceFilename: srcFilename,
        outputFormat,
        quality: qualityForPages,
        resizePct,
        maxWidth: config.maxWidth,
      });
      outputBuf = rendered.zipBuffer;
      pageCount = rendered.pageCount;
      outputCount = rendered.pageCount;
      packaging = "zip";
      contentType = "application/zip";
      outputFilename = `${stripExt(srcFilename)}_${outputFormat.toLowerCase()}_pages.zip`;
      if (srcIsDocx && rendered.fidelity) {
        console.log(
          JSON.stringify({
            event: "fidelity_metrics",
            sourceType: "DOCX",
            target: outputFormat,
            engine: canonicalPdf?.meta.converter ?? "libreoffice",
            libreofficeVersion: canonicalPdf?.meta.libreofficeVersion ?? "unknown",
            pageCount: rendered.pageCount,
            threshold: rendered.fidelity.threshold,
            maxMae: rendered.fidelity.maxMae,
            avgMae: rendered.fidelity.avgMae,
          })
        );
      }
    } else {
      // Image output for non-document inputs.
      outputBuf = await applyConversion({
        rawBuf,
        sourceInfo,
        fmt: outputFormat,
        quality,
        resizePct,
        config,
      });
    }

    const outputKey = `private/${userSub}/${projectId}/output/${outputFileId}/${outputFilename}`;

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
      packaging,
      pageCount,
      outputCount,
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
