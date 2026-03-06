// app/app/projects/[projectId]/_lib/ui-types.ts
export type OutputFormat = "PNG" | "JPG" | "WebP" | "GIF" | "TIFF" | "AVIF" | "DOCX" | "PDF";

/** Formats that produce image output (Quality/Resize/Presets apply). */
export const IMAGE_OUTPUT_FORMATS: OutputFormat[] = ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"];

export type PresetId = "web" | "hq" | "email";

/** Per-item settings used in the Ready queue and sent to the API. */
export type ItemSettings = {
  format: OutputFormat;
  quality: number;   // 1–100
  preset: PresetId;
  resizePct: number; // 10–100, 100 = no resize
};

export type LocalReadyFile = {
  id: string;
  file: File;
  previewUrl: string;
  fromLabel: string;
  toFormat: OutputFormat;
  quality: number;
  preset: PresetId;
  resizePct: number;
  sizeLabel: string;
  selected: boolean;
};

export type LocalConvertedFile = {
  id: string;
  filename: string;
  name: string;
  previewUrl?: string;
  fromLabel: string;
  /** Immutable: the actual output format used for this conversion (stored in DDB). */
  toLabel: string;
  sourceFileId?: string;
  fromSizeLabel?: string;
  toSizeLabel?: string;
  sizeBytes?: number;
  sizeLabel: string;
  whenLabel?: string;
  status: "done" | "processing" | "failed";
  progress?: number;
};

// Valid output formats per source format label.
export const VALID_OUTPUT_FORMATS: Record<string, OutputFormat[]> = {
  PNG:  ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  JPG:  ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  WebP: ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  GIF:  ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  TIFF: ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  AVIF: ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
  BMP:  ["PNG", "JPG", "WebP", "TIFF", "AVIF"],
  HEIC: ["PNG", "JPG", "WebP", "AVIF"],
  SVG:  ["PNG", "JPG", "WebP"],
  ICO:  ["PNG", "JPG", "WebP"],
  PDF:  ["PNG", "JPG", "WebP", "DOCX"], // rasterize page 1 OR export to editable DOCX
  DOCX: ["PNG", "JPG", "WebP", "PDF"],  // render text preview as image OR export to PDF
  IMG:  ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF"],
};

/** All selectable output formats (shown in the sidebar format picker). */
export const ALL_OUTPUT_FORMATS: OutputFormat[] = ["PNG", "JPG", "WebP", "GIF", "TIFF", "AVIF", "DOCX"];
