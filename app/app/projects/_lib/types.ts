// app/app/projects/types.ts

export type ProjectRow = {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

export type Stats = {
  totalProjects: number;
  totalFiles: number;
  spaceSavedBytes: number;
};

export type FileRow = {
  fileId: string;
  projectId: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  bucket: string;
  key: string;
};

export type ProjectMeta = {
  fileCount: number;
  latestActivityAt: string; // ISO
};

export type MenuState =
  | { open: false }
  | { open: true; projectId: string; x: number; y: number };

export type UiStatus =
  | "queued"
  | "processing"
  | "done"
  | "failed"
  | "unknown";

export type CreateUploadResult = {
  uploadId: string;
  putUrl: string;
  bucket: string;
  key: string;
  method: "PUT";
  headers: Record<string, string>;
};

export type CompleteUploadResult = {
  file?: FileRow;
};
