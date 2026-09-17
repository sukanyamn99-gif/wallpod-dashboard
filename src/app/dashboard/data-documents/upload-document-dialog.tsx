"use client";

import { useActionState, useState } from "react";
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
import { resizeImageToBlob } from "@/lib/image-resize";
import { createDataDocument } from "./actions";

const initialState = { error: null as string | null };

export function UploadDocumentDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<{ blob: Blob; previewUrl: string } | null>(null);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createDataDocument(formData);
    if (!result.error) {
      setOpen(false);
      setFile(null);
      if (thumbnail) URL.revokeObjectURL(thumbnail.previewUrl);
      setThumbnail(null);
    }
    return result;
  }, initialState);

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
        <form
          action={formAction}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (thumbnail) fd.set("thumbnail", thumbnail.blob, "thumbnail.jpg");
            formAction(fd);
          }}
        >
          <DialogBody className="space-y-4 pb-4">
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <div className="space-y-2">
              <Label htmlFor="doc_title">ชื่อเอกสาร</Label>
              <Input id="doc_title" name="title" required placeholder="เช่น Acoustic Silencer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc_category">หมวดหมู่</Label>
              <Input id="doc_category" name="category" defaultValue="เอกสาร" />
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
              {pending ? "กำลังอัปโหลด..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
