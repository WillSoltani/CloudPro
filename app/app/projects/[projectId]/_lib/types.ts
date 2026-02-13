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
  
  export type UiStatus = "queued" | "processing" | "done" | "failed" | "unknown";
  
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
  