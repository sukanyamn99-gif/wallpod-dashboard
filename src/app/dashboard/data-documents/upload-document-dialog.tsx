"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { uploadResumable } from "@/lib/data-documents-upload";
import { createClient } from "@/lib/supabase/client";
import { recordDataDocument } from "./actions";

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

      await uploadResumable(file, filePath, session.access_token, setProgress);

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
