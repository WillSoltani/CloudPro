export const OUTPUT_FORMATS = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "TIFF",
  "AVIF",
  "BMP",
  "ICO",
  "SVG",
  "PDF",
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const IMAGE_OUTPUT_FORMATS = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "TIFF",
  "AVIF",
  "BMP",
  "ICO",
  "SVG",
] as const;

export type SourceFormatLabel =
  | "PNG"
  | "JPG"
  | "WebP"
  | "GIF"
  | "TIFF"
  | "AVIF"
  | "BMP"
  | "HEIC"
  | "SVG"
  | "ICO"
  | "PDF"
  | "DOCX"
  | "PAGES"
  | "IMG";

export const INPUT_ONLY_FORMAT_LABELS = ["DOCX", "PAGES"] as const;
export type InputOnlyFormatLabel = (typeof INPUT_ONLY_FORMAT_LABELS)[number];

const IMAGE_OUTPUTS_WITH_PDF: readonly OutputFormat[] = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "TIFF",
  "AVIF",
  "BMP",
  "ICO",
  "SVG",
  "PDF",
];

const ICON_OUTPUTS_WITH_PDF: readonly OutputFormat[] = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "TIFF",
  "AVIF",
  "BMP",
  "ICO",
  "PDF",
];

export const SOURCE_LABEL_OUTPUT_FORMATS: Record<SourceFormatLabel, readonly OutputFormat[]> = {
  PNG: IMAGE_OUTPUTS_WITH_PDF,
  JPG: IMAGE_OUTPUTS_WITH_PDF,
  WebP: IMAGE_OUTPUTS_WITH_PDF,
  GIF: IMAGE_OUTPUTS_WITH_PDF,
  TIFF: IMAGE_OUTPUTS_WITH_PDF,
  AVIF: IMAGE_OUTPUTS_WITH_PDF,
  BMP: IMAGE_OUTPUTS_WITH_PDF,
  HEIC: IMAGE_OUTPUTS_WITH_PDF,
  SVG: IMAGE_OUTPUTS_WITH_PDF,
  ICO: ICON_OUTPUTS_WITH_PDF,
  PDF: ["PNG", "JPG", "WebP"],
  DOCX: ["PNG", "JPG", "WebP", "PDF"],
  PAGES: ["PNG", "JPG", "WebP", "PDF"],
  IMG: IMAGE_OUTPUTS_WITH_PDF,
};

export const CONTENT_TYPE_OUTPUT_FORMATS: Record<string, readonly OutputFormat[]> = {
  "image/png": IMAGE_OUTPUTS_WITH_PDF,
  "image/x-png": IMAGE_OUTPUTS_WITH_PDF,
  "image/jpeg": IMAGE_OUTPUTS_WITH_PDF,
  "image/jpg": IMAGE_OUTPUTS_WITH_PDF,
  "image/pjpeg": IMAGE_OUTPUTS_WITH_PDF,
  "image/webp": IMAGE_OUTPUTS_WITH_PDF,
  "image/gif": IMAGE_OUTPUTS_WITH_PDF,
  "image/tiff": IMAGE_OUTPUTS_WITH_PDF,
  "image/x-tiff": IMAGE_OUTPUTS_WITH_PDF,
  "image/avif": IMAGE_OUTPUTS_WITH_PDF,
  "image/heic": IMAGE_OUTPUTS_WITH_PDF,
  "image/heif": IMAGE_OUTPUTS_WITH_PDF,
  "image/bmp": IMAGE_OUTPUTS_WITH_PDF,
  "image/x-bmp": IMAGE_OUTPUTS_WITH_PDF,
  "image/svg+xml": IMAGE_OUTPUTS_WITH_PDF,
  "image/x-icon": ICON_OUTPUTS_WITH_PDF,
  "image/vnd.microsoft.icon": ICON_OUTPUTS_WITH_PDF,
  "image/icon": ICON_OUTPUTS_WITH_PDF,
  "application/pdf": ["PNG", "JPG", "WebP"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["PNG", "JPG", "WebP", "PDF"],
  "application/msword": ["PNG", "JPG", "WebP", "PDF"],
  "application/vnd.apple.pages": ["PNG", "JPG", "WebP", "PDF"],
  "application/x-iwork-pages-sffpages": ["PNG", "JPG", "WebP", "PDF"],
};

export const UPLOAD_FILE_INPUT_ACCEPT =
  "image/*,.svg,.heic,.heif,.pdf,.doc,.docx,.pages,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.apple.pages,application/x-iwork-pages-sffpages";

export const SUPPORTED_UPLOAD_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "tif",
  "tiff",
  "avif",
  "heic",
  "heif",
  "bmp",
  "svg",
  "ico",
  "pdf",
  "doc",
  "docx",
  "pages",
] as const;

export const SUPPORTED_UPLOAD_FORMATS_TEXT =
  "PNG, JPG, WebP, GIF, TIFF, AVIF, HEIC/HEIF, BMP, SVG, ICO, PDF, DOC, DOCX, PAGES";

const DEFAULT_RECOMMENDATION_PRIORITY: readonly OutputFormat[] = [
  "PDF",
  "PNG",
  "JPG",
  "WebP",
  "AVIF",
  "BMP",
  "TIFF",
  "GIF",
  "SVG",
  "ICO",
];

const SOURCE_RECOMMENDATION_PRIORITY: Record<SourceFormatLabel, readonly OutputFormat[]> = {
  PNG: ["JPG", "WebP", "PDF", "ICO", "AVIF", "TIFF", "GIF", "BMP", "SVG", "PNG"],
  JPG: ["PNG", "WebP", "PDF", "TIFF", "AVIF", "GIF", "BMP", "ICO", "SVG", "JPG"],
  WebP: ["JPG", "PNG", "PDF", "TIFF", "AVIF", "GIF", "BMP", "ICO", "SVG", "WebP"],
  GIF: ["PNG", "WebP", "JPG", "PDF", "AVIF", "TIFF", "BMP", "ICO", "SVG", "GIF"],
  TIFF: ["PDF", "JPG", "PNG", "WebP", "AVIF", "GIF", "BMP", "ICO", "SVG", "TIFF"],
  AVIF: ["JPG", "PNG", "PDF", "WebP", "TIFF", "BMP", "GIF", "ICO", "SVG", "AVIF"],
  BMP: ["PNG", "JPG", "WebP", "PDF", "AVIF", "TIFF", "GIF", "ICO", "SVG", "BMP"],
  HEIC: ["PDF", "JPG", "PNG", "WebP", "ICO", "BMP", "AVIF", "SVG"],
  SVG: ["PNG", "PDF", "WebP", "JPG", "ICO", "AVIF", "TIFF", "GIF", "BMP", "SVG"],
  ICO: ["PNG", "WebP", "JPG", "PDF", "BMP", "AVIF", "TIFF", "GIF", "ICO"],
  PDF: ["PNG", "JPG", "WebP"],
  DOCX: ["PDF", "PNG", "JPG", "WebP"],
  PAGES: ["PDF", "PNG", "JPG", "WebP"],
  IMG: ["PDF", "PNG", "JPG", "WebP", "AVIF", "BMP", "TIFF", "GIF", "SVG", "ICO"],
};

const POPULAR_TARGETS_BY_SOURCE: Record<SourceFormatLabel, readonly OutputFormat[]> = {
  PNG: ["JPG", "WebP", "PDF", "ICO"],
  JPG: ["PNG", "WebP", "PDF", "TIFF"],
  WebP: ["JPG", "PNG", "PDF", "TIFF"],
  GIF: ["PNG", "WebP", "JPG", "PDF"],
  TIFF: ["PDF", "JPG", "PNG", "WebP"],
  AVIF: ["JPG", "PNG", "PDF", "WebP"],
  BMP: ["PNG", "JPG", "WebP", "PDF"],
  HEIC: ["PDF", "JPG", "PNG", "WebP"],
  SVG: ["PNG", "PDF", "WebP", "JPG"],
  ICO: ["PNG", "WebP", "JPG", "PDF"],
  PDF: ["PNG", "JPG", "WebP"],
  DOCX: ["PDF", "PNG", "JPG", "WebP"],
  PAGES: ["PDF", "PNG", "JPG", "WebP"],
  IMG: ["PDF", "PNG", "JPG", "WebP"],
};

const NO_OP_TARGET_BY_SOURCE: Partial<Record<SourceFormatLabel, OutputFormat>> = {
  PNG: "PNG",
  JPG: "JPG",
  WebP: "WebP",
  GIF: "GIF",
  TIFF: "TIFF",
  AVIF: "AVIF",
  BMP: "BMP",
  SVG: "SVG",
  ICO: "ICO",
  PDF: "PDF",
};

export const FORMAT_CAPABILITIES = {
  supportedInputs: Object.keys(SOURCE_LABEL_OUTPUT_FORMATS) as SourceFormatLabel[],
  supportedOutputs: [...OUTPUT_FORMATS] as OutputFormat[],
  conversionMatrix: SOURCE_LABEL_OUTPUT_FORMATS,
} as const;

const SUPPORTED_UPLOAD_EXT_SET = new Set<string>(SUPPORTED_UPLOAD_EXTENSIONS);

function extFromFilename(name: string): string {
  const base = (name || "").split("?")[0].split("#")[0];
  const i = base.lastIndexOf(".");
  if (i < 0) return "";
  return base.slice(i + 1).toLowerCase();
}

function asSourceLabel(sourceLabel: string): SourceFormatLabel {
  if (sourceLabel in SOURCE_LABEL_OUTPUT_FORMATS) {
    return sourceLabel as SourceFormatLabel;
  }
  return "IMG";
}

export function normalizeContentType(contentType: string | null | undefined): string {
  return (contentType || "").toLowerCase().split(";")[0].trim();
}

export function allowedOutputFormatsForContentType(contentType: string): OutputFormat[] {
  const ct = normalizeContentType(contentType);
  if (CONTENT_TYPE_OUTPUT_FORMATS[ct]) return [...CONTENT_TYPE_OUTPUT_FORMATS[ct]];
  if (ct.startsWith("image/")) return [...SOURCE_LABEL_OUTPUT_FORMATS.IMG];
  return [];
}

export function allowedOutputFormatsForSourceLabel(sourceLabel: string): OutputFormat[] {
  const mapped = SOURCE_LABEL_OUTPUT_FORMATS[asSourceLabel(sourceLabel)];
  return mapped ? [...mapped] : [...SOURCE_LABEL_OUTPUT_FORMATS.IMG];
}

export function invalidTargetReasonForSourceLabel(
  sourceLabel: string,
  target: OutputFormat | string
): string | null {
  const normalized = asSourceLabel(sourceLabel);
  const isOutputTarget = OUTPUT_FORMATS.includes(target as OutputFormat);
  if (!isOutputTarget) {
    return `${target} is supported as an input format only`;
  }

  const outputTarget = target as OutputFormat;
  const supportedTargets = SOURCE_LABEL_OUTPUT_FORMATS[normalized] ?? SOURCE_LABEL_OUTPUT_FORMATS.IMG;

  if (!supportedTargets.includes(outputTarget)) {
    return `${normalized} cannot convert to ${outputTarget}`;
  }

  const noOpTarget = NO_OP_TARGET_BY_SOURCE[normalized];
  if (noOpTarget && noOpTarget === outputTarget) {
    return `Already ${outputTarget}; choose a different target format`;
  }

  return null;
}

export function isSupportedUploadFile(file: { name: string; type?: string | null }): boolean {
  const ext = extFromFilename(file.name);
  if (SUPPORTED_UPLOAD_EXT_SET.has(ext)) return true;
  const ct = normalizeContentType(file.type);
  if (!ct) return false;
  return ct in CONTENT_TYPE_OUTPUT_FORMATS;
}

export function sortOutputsByRecommendation(
  outputs: readonly OutputFormat[],
  sourceLabels: readonly string[]
): OutputFormat[] {
  const labels = sourceLabels.map((s) => asSourceLabel(s));

  let priority = DEFAULT_RECOMMENDATION_PRIORITY;
  if (labels.length > 0 && labels.every((l) => l === labels[0])) {
    priority = SOURCE_RECOMMENDATION_PRIORITY[labels[0]] ?? DEFAULT_RECOMMENDATION_PRIORITY;
  }

  const rank = new Map<OutputFormat, number>();
  priority.forEach((fmt, idx) => rank.set(fmt, idx));

  return [...outputs].sort((a, b) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    const ia = OUTPUT_FORMATS.indexOf(a);
    const ib = OUTPUT_FORMATS.indexOf(b);
    return ia - ib;
  });
}

export function recommendedOutputsForSourceLabels(
  sourceLabels: readonly string[],
  availableOutputs: readonly OutputFormat[],
  maxCount: number = 4
): OutputFormat[] {
  const labels = sourceLabels.map((s) => asSourceLabel(s));
  const availableSet = new Set(availableOutputs);

  if (labels.length > 0 && labels.every((l) => l === labels[0])) {
    const source = labels[0];
    const curated = (POPULAR_TARGETS_BY_SOURCE[source] ?? [])
      .filter((fmt) => availableSet.has(fmt))
      .filter((fmt) => !invalidTargetReasonForSourceLabel(source, fmt));

    if (curated.length >= Math.min(maxCount, availableOutputs.length)) {
      return curated.slice(0, maxCount);
    }

    const fallback = sortOutputsByRecommendation(availableOutputs, [source]).filter(
      (fmt) => !invalidTargetReasonForSourceLabel(source, fmt)
    );
    const merged = [...curated, ...fallback.filter((fmt) => !curated.includes(fmt))];
    return merged.slice(0, maxCount);
  }

  return sortOutputsByRecommendation(availableOutputs, labels).slice(0, maxCount);
}
