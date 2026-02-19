export type OutputFormat = "PNG" | "JPG" | "WebP" | "GIF" | "SVG" | "ICO" | "BMP" | "TIFF";

export type PresetId = "web" | "print" | "social" | "tiny" | "web" | "hq" | "email";

export type LocalReadyFile = {
  id: string;
  file: File;
  previewUrl: string;
  fromLabel: string;
  toFormat: OutputFormat; // <-- MUST be OutputFormat
  sizeLabel: string;
  selected: boolean;
};

export type LocalConvertedFile = {
  id: string;
  filename: string;
  name: string;
  previewUrl?: string;
  fromLabel: string;
  toLabel: string;
  fromSizeLabel?: string;
  toSizeLabel?: string;
  sizeLabel: string;
  whenLabel?: string;
  status: "done" | "processing" | "failed";
  progress?: number;
  format: OutputFormat;
};
