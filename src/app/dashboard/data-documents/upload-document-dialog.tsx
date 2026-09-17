"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import { ImagePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resizeImageToBlob } from "@/lib/image-resize";
import { DATA_DOCUMENTS_BUCKET, DATA_DOCUMENT_CATEGORIES } from "@/lib/data-documents-constants";
import { createClient } from "@/lib/supabase/client";
import { recordDataDocument } from "./actions";

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

function resolveContentType(file: File): string {
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
function uploadResumable(
  file: File | Blob,
  fileName: string,
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

export function UploadDocumentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [category, setCategory] = useState<string>(DATA_DOCUMENT_CATEGORIES[0]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("กรุณาเลือกไฟล์เอกสาร");
      return;
    }
    setPending(true);
    setProgress(0);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const id = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const filePath = `${id}/file.${ext}`;

      await uploadResumable(file, file.name, filePath, session.access_token, setProgress);

      // The cover thumbnail is small (resized to 600x600 JPEG) — simple
      // upload is fine for it, unlike the main document file above.
      let thumbnailPath: string | null = null;
      if (thumbnail) {
        const candidatePath = `${id}/thumbnail.jpg`;
        const { error: thumbErr } = await supabase.storage
          .from(DATA_DOCUMENTS_BUCKET)
          .upload(candidatePath, thumbnail.blob, { contentType: "image/jpeg" });
        if (!thumbErr) thumbnailPath = candidatePath; // best-effort — missing thumbnail just falls back to a generic icon
      }

      const result = await recordDataDocument({
        title,
        category,
        filePath,
        fileType: ext.toUpperCase(),
        fileSizeBytes: file.size,
        thumbnailPath,
      });
      if (result.error) {
        await supabase.storage
          .from(DATA_DOCUMENTS_BUCKET)
          .remove([filePath, ...(thumbnailPath ? [thumbnailPath] : [])]);
        setError(result.error);
        return;
      }

      setOpen(false);
      setFile(null);
      setCategory(DATA_DOCUMENT_CATEGORIES[0]);
      if (thumbnail) URL.revokeObjectURL(thumbnail.previewUrl);
      setThumbnail(null);
      router.refresh();
    } catch {
      setError("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  async function handleThumbnailSelect(f: File) {
    const blob = await resizeImageToBlob(f, 600, 600, 0.8);
    if (thumbnail) URL.revokeObjectURL(thumbnail.previewUrl);
    setThumbnail({ blob, previewUrl: URL.createObjectURL(blob) });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        เพิ่มเอกสาร
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่มเอกสารข้อมูล</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4 pb-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="doc_title">ชื่อเอกสาร</Label>
              <Input id="doc_title" name="title" required placeholder="เช่น Acoustic Silencer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc_category">หมวดหมู่</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory((v as string) ?? category)}
                items={DATA_DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
              >
                <SelectTrigger id="doc_category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc_file">ไฟล์เอกสาร (PDF ฯลฯ)</Label>
              <Input
                id="doc_file"
                name="file"
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>รูปปก (ไม่บังคับ)</Label>
              {thumbnail ? (
                <div className="relative h-24 w-24">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable remote asset */}
                  <img src={thumbnail.previewUrl} alt="" className="h-24 w-24 rounded border object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(thumbnail.previewUrl);
                      setThumbnail(null);
                    }}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed text-muted-foreground hover:text-foreground">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px]">เพิ่มรูปปก</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleThumbnailSelect(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? `กำลังอัปโหลด... ${progress}%` : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
