import type { FileRow } from "../../_lib/types";

type CreateUploadBody = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type CreateUploadResponse = {
  upload: {
    uploadId: string;
    putUrl: string;
    bucket: string;
    key: string;
    headers: Record<string, string>;
  };
};

export type ConversionJob = {
  fileId: string;
  outputFormat: string;
  quality: number | null;
  preset: string | null;
  resizePct: number | null;
};

export type ConvertRequest = {
  conversions: ConversionJob[];
};

export type ConvertResultItem =
  | { fileId: string; ok: true; outputFileId: string }
  | { fileId: string; ok: false; error: string };

export type ConvertResponse = {
  ok: boolean;
  projectId: string;
  results: ConvertResultItem[];
};

export type CreateFilledPdfUploadPayload = {
  originalFileId: string;
  filename: string;
  sizeBytes: number;
};

export type CreateFilledPdfUploadResponse = {
  upload: {
    fileId: string;
    putUrl: string;
    bucket: string;
    key: string;
    headers: Record<string, string>;
  };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return `request failed: ${res.status}`;

  // try JSON { error, detail }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isRecord(parsed)) {
      const err = getString(parsed, "error");
      const detail = getString(parsed, "detail");
      if (err && detail) return `${err}: ${detail}`;
      if (err) return err;
      if (detail) return detail;
    }
  } catch {
    // ignore
  }

  return text;
}

/**
 * Defaults to validate=1 so the server reconciles:
 * - if S3 object is missing -> deletes Dynamo record
 */
export async function listFiles(projectId: string, opts?: { validate?: boolean }): Promise<FileRow[]> {
  const validate = opts?.validate ?? true;
  const qs = validate ? "?validate=1" : "";

  const res = await fetch(`/app/api/projects/${encodeURIComponent(projectId)}/files${qs}`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { files?: FileRow[] };
  return data.files ?? [];
}

export async function createUpload(projectId: string, file: File) {
  const body: CreateUploadBody = {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };

  const res = await fetch(`/app/api/projects/${encodeURIComponent(projectId)}/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(`create upload failed: ${res.status} ${msg}`);
  }

  const data = (await res.json()) as CreateUploadResponse;
  if (!data?.upload?.uploadId || !data.upload.putUrl) {
    throw new Error("create upload returned invalid payload");
  }
  return data.upload;
}

export async function completeUpload(
  projectId: string,
  payload: {
    uploadId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    bucket: string;
    key: string;
  }
) {
  const res = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(payload.uploadId)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        filename: payload.filename,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes,
        bucket: payload.bucket,
        key: payload.key,
      }),
    }
  );

  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(`complete upload failed: ${res.status} ${msg}`);
  }
}

export async function deleteFile(projectId: string, fileId: string) {
  const res = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE", cache: "no-store" }
  );

  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(`Delete failed: ${res.status} ${msg}`);
  }
}

export async function createFilledPdfUpload(
  projectId: string,
  payload: CreateFilledPdfUploadPayload
) {
  const res = await fetch(`/app/api/projects/${encodeURIComponent(projectId)}/files/filled/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(`create filled upload failed: ${res.status} ${msg}`);
  }
  const data = (await res.json()) as CreateFilledPdfUploadResponse;
  if (!data?.upload?.fileId || !data.upload.putUrl) {
    throw new Error("create filled upload returned invalid payload");
  }
  return data.upload;
}

export async function completeFilledPdfUpload(
  projectId: string,
  fileId: string,
  payload: { bucket: string; key: string; sizeBytes: number }
) {
  const res = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/files/filled/${encodeURIComponent(fileId)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(`complete filled upload failed: ${res.status} ${msg}`);
  }
}

export async function uploadFilledPdfBytes(
  projectId: string,
  fileId: string,
  bytes: Uint8Array
) {
  const res = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/files/filled/${encodeURIComponent(fileId)}/upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      cache: "no-store",
      body: bytes,
    }
  );
  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(`upload filled pdf failed: ${res.status} ${msg}`);
  }
}

/**
 * Your API returns { inlineUrl, downloadUrl }.
 * This returns inlineUrl first (best for thumbnails), then falls back to url or downloadUrl.
 */
export async function getInlineUrl(projectId: string, fileId: string): Promise<string | null> {
  const res = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as unknown;

  if (isRecord(data)) {
    const inlineUrl = getString(data, "inlineUrl");
    if (inlineUrl) return inlineUrl;

    const url = getString(data, "url");
    if (url) return url;

    const downloadUrl = getString(data, "downloadUrl");
    if (downloadUrl) return downloadUrl;
  }

  return null;
}

/**
 * Step 4 wiring: call the Step 3 endpoint and return the parsed result.
 */
export async function convertFiles(projectId: string, payload: ConvertRequest): Promise<ConvertResponse> {
  const res = await fetch(`/app/api/projects/${encodeURIComponent(projectId)}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(`convert failed: ${res.status} ${msg}`);
  }

  const json = (await res.json()) as unknown;
  if (!isRecord(json)) throw new Error("convert returned invalid payload");

  const ok = Boolean(json.ok);
  const pid = getString(json, "projectId") ?? projectId;

  const resultsRaw = json.results;
  const results: ConvertResultItem[] = Array.isArray(resultsRaw)
    ? resultsRaw
        .map((r) => {
          if (!isRecord(r)) return null;
          const fileId = getString(r, "fileId");
          const okVal = r.ok === true;
          if (!fileId) return null;

          if (okVal) {
            const outputFileId = getString(r, "outputFileId");
            if (!outputFileId) return null;
            return { fileId, ok: true as const, outputFileId };
          }

          const err = getString(r, "error") ?? "unknown error";
          return { fileId, ok: false as const, error: err };
        })
        .filter((x): x is ConvertResultItem => x !== null)
    : [];

  return { ok, projectId: pid, results };
}
