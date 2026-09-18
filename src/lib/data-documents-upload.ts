// Shared client-side upload helpers for Data Documents — used by both the
// create dialog and the edit dialog, so the two never drift out of sync on
// how a file actually gets to Storage.
import * as tus from "tus-js-client";
import { DATA_DOCUMENTS_BUCKET } from "@/lib/data-documents-constants";

// A blank `file.type` (some OS/browser combinations don't always populate
// it) fell back to application/octet-stream — the browser can't tell that's
// really a viewable PDF, so it force-downloaded instead of previewing
// inline in the "ดูตัวอย่าง" tab, which read as "the view button acts like
// the download button." Extension-based fallback keeps that from happening
// for the file types this library actually deals with.
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function resolveContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

// Supabase's simple storage.upload() (a single POST) proved unreliable for
// real catalog PDFs in real testing — it hung indefinitely and never
// resolved, even for a 500KB file. This is Supabase's own documented
// reason for recommending the resumable (TUS) protocol for anything but
// the smallest files: it uploads in fixed 6MB chunks (a hard requirement
// of Supabase's TUS endpoint, not a tunable choice) with retries per
// chunk, instead of one long-lived request that has no way to recover if
// it stalls.
export function uploadResumable(
  file: File | Blob,
  path: string,
  accessToken: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${accessToken}`, apikey: anonKey },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: DATA_DOCUMENTS_BUCKET,
        objectName: path,
        contentType: file instanceof File ? resolveContentType(file) : "image/jpeg",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}
