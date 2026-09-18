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
import { Label } from "@/components/ui/label";
import { resizeImageToBlob } from "@/lib/image-resize";
import { DATA_DOCUMENTS_BUCKET } from "@/lib/data-documents-constants";
import { createClient } from "@/lib/supabase/client";
import { updateDataDocumentThumbnail } from "./actions";
import type { DataDocument } from "@/lib/types";

export function EditThumbnailDialog({ document, currentThumbnailUrl }: { document: DataDocument; currentThumbnailUrl?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newThumbnail, setNewThumbnail] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const previewUrl = newThumbnail ? newThumbnail.previewUrl : removeExisting ? null : currentThumbnailUrl;

  async function handleSelect(f: File) {
    const blob = await resizeImageToBlob(f, 600, 600, 0.8);
    if (newThumbnail) URL.revokeObjectURL(newThumbnail.previewUrl);
    setNewThumbnail({ blob, previewUrl: URL.createObjectURL(blob) });
    setRemoveExisting(false);
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      let thumbnailPath: string | null = document.thumbnailPath;

      if (newThumbnail) {
        const candidatePath = `${document.id}/thumbnail-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from(DATA_DOCUMENTS_BUCKET)
          .upload(candidatePath, newThumbnail.blob, { contentType: "image/jpeg" });
        if (uploadErr) {
          setError(`อัปโหลดรูปปกไม่สำเร็จ: ${uploadErr.message}`);
          return;
        }
        thumbnailPath = candidatePath;
      } else if (removeExisting) {
        thumbnailPath = null;
      }

      const result = await updateDataDocumentThumbnail(document.id, thumbnailPath);
      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      if (newThumbnail) URL.revokeObjectURL(newThumbnail.previewUrl);
      setNewThumbnail(null);
      setRemoveExisting(false);
      router.refresh();
    } catch {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="icon" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขหน้าปก — {document.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4 pb-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label>หน้าปก</Label>
            {previewUrl ? (
              <div className="relative h-32 w-32">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob or private signed URL preview, not an optimizable remote asset */}
                <img src={previewUrl} alt="" className="h-32 w-32 rounded border object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    if (newThumbnail) URL.revokeObjectURL(newThumbnail.previewUrl);
                    setNewThumbnail(null);
                    setRemoveExisting(true);
                  }}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed text-muted-foreground hover:text-foreground">
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px]">เพิ่มรูปปก</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelect(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
