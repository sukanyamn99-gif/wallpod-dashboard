"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Pencil, X } from "lucide-react";
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
import { updateDataDocument } from "./actions";
import type { DataDocument } from "@/lib/types";

export function EditDocumentDialog({ document, currentThumbnailUrl }: { document: DataDocument; currentThumbnailUrl?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [category, setCategory] = useState<string>(document.category);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [removeExistingThumbnail, setRemoveExistingThumbnail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);

  const thumbnailPreviewUrl = thumbnail
    ? thumbnail.previewUrl
    : removeExistingThumbnail
      ? null
      : currentThumbnailUrl;

  function resetLocalState() {
    setFile(null);
    if (thumbnail) URL.revokeObjectURL(thumbnail.previewUrl);
    setThumbnail(null);
    setRemoveExistingThumbnail(false);
    setError(null);
    setProgress(0);
  }

  async function handleThumbnailSelect(f: File) {
    const blob = await resizeImageToBlob(f, 600, 600, 0.8);
    if (thumbnail) URL.revokeObjectURL(thumbnail.previewUrl);
    setThumbnail({ blob, previewUrl: URL.createObjectURL(blob) });
    setRemoveExistingThumbnail(false);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("กรุณากรอกชื่อเอกสาร");
      return;
    }
    setPending(true);
    setProgress(0);
    setError(null);

    const uploadedPaths: string[] = [];
    try {
      const supabase = createClient();
      let fileFields: { filePath: string; fileType: string; fileSizeBytes: number } | undefined;

      if (file) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
          return;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const filePath = `${document.id}/file-${Date.now()}.${ext}`;
        await uploadResumable(file, filePath, session.access_token, setProgress);
        uploadedPaths.push(filePath);
        fileFields = { filePath, fileType: ext.toUpperCase(), fileSizeBytes: file.size };
      }

      let thumbnailPath: string | null = document.thumbnailPath;
      if (thumbnail) {
        const candidatePath = `${document.id}/thumbnail-${Date.now()}.jpg`;
        const { error: thumbErr } = await supabase.storage
          .from(DATA_DOCUMENTS_BUCKET)
          .upload(candidatePath, thumbnail.blob, { contentType: "image/jpeg" });
        if (thumbErr) {
          setError(`อัปโหลดรูปปกไม่สำเร็จ: ${thumbErr.message}`);
          return;
        }
        uploadedPaths.push(candidatePath);
        thumbnailPath = candidatePath;
      } else if (removeExistingThumbnail) {
        thumbnailPath = null;
      }

      const result = await updateDataDocument(document.id, {
        title: title.trim(),
        category,
        thumbnailPath,
        file: fileFields,
      });
      if (result.error) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(DATA_DOCUMENTS_BUCKET).remove(uploadedPaths);
        }
        setError(result.error);
        return;
      }

      setOpen(false);
      resetLocalState();
      router.refresh();
    } catch {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetLocalState();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="icon" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขเอกสาร</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4 pb-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="edit_doc_title">ชื่อเอกสาร</Label>
            <Input id="edit_doc_title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_doc_category">หมวดหมู่</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory((v as string) ?? category)}
              items={DATA_DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            >
              <SelectTrigger id="edit_doc_category" className="w-full">
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
            <Label htmlFor="edit_doc_file">ไฟล์เอกสาร (ไม่บังคับ — เว้นว่างไว้เพื่อใช้ไฟล์เดิม)</Label>
            <Input id="edit_doc_file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">
              {file ? `ไฟล์ใหม่: ${file.name}` : `ไฟล์ปัจจุบัน: ${document.fileType}`}
            </p>
          </div>
          <div className="space-y-2">
            <Label>หน้าปก</Label>
            {thumbnailPreviewUrl ? (
              <div className="relative h-24 w-24">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob or private signed URL preview, not an optimizable remote asset */}
                <img src={thumbnailPreviewUrl} alt="" className="h-24 w-24 rounded border object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    if (thumbnail) URL.revokeObjectURL(thumbnail.previewUrl);
                    setThumbnail(null);
                    setRemoveExistingThumbnail(true);
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
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending && file ? `กำลังอัปโหลด... ${progress}%` : pending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
