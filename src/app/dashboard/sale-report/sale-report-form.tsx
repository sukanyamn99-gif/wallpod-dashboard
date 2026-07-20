"use client";

import { useActionState, useState } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSaleReport } from "./actions";
import { resizeImageToBlob } from "@/lib/image-resize";
import type { CustomerType, ProjectType, SalesRep, Stage } from "@/lib/types";

const initialState = { error: null as string | null };

const CUSTOMER_TYPES: CustomerType[] = [
  "Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School",
];

const PROJECT_TYPES: ProjectType[] = [
  "ออฟฟิศ", "โรงแรม", "โรงเรียน", "โรงพยาบาล", "บ้าน", "คอนโด", "ห้องซ้อมดนตรี", "อื่นๆ",
];

const STAGES: Stage[] = ["นำเสนอ", "ใบเสนอราคา", "เจรจาต่อรอง", "ปิดการขาย", "ไม่สำเร็จ"];

const MAX_IMAGES = 10;

interface PendingImage {
  blob: Blob;
  previewUrl: string;
}

export function SaleReportForm({ salesReps }: { salesReps: SalesRep[] }) {
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [images, setImages] = useState<PendingImage[]>([]);
  const [resizing, setResizing] = useState(false);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createSaleReport(formData);
    if (!result.error) {
      setLocation("");
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
    }
    return result;
  }, initialState);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("เบราว์เซอร์นี้ไม่รองรับการขอตำแหน่ง");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation(`https://maps.google.com/?q=${latitude},${longitude}`);
        setLocating(false);
      },
      () => {
        setLocationError("ขอตำแหน่งไม่สำเร็จ กรุณาวางลิงก์ Google Maps เอง");
        setLocating(false);
      },
    );
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setResizing(true);
    try {
      const resized = await Promise.all(files.map((f) => resizeImageToBlob(f)));
      setImages((prev) =>
        [...prev, ...resized.map((blob) => ({ blob, previewUrl: URL.createObjectURL(blob) }))].slice(
          0,
          MAX_IMAGES,
        ),
      );
    } finally {
      setResizing(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        images.forEach((img, i) => fd.append("images", img.blob, `image-${i}.jpg`));
        formAction(fd);
      }}
    >
      {state.error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="sales_rep_id">เซลล์</Label>
        <Select
          name="sales_rep_id"
          required
          items={salesReps.map((rep) => ({ value: rep.id, label: rep.name }))}
        >
          <SelectTrigger id="sales_rep_id" className="w-full">
            <SelectValue placeholder="เลือกเซลล์" />
          </SelectTrigger>
          <SelectContent>
            {salesReps.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {rep.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer_name">ชื่อลูกค้า</Label>
        <Input id="customer_name" name="customer_name" required placeholder="เช่น บจก. ABC" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">เบอร์โทร</Label>
        <Input id="phone" name="phone" type="tel" placeholder="เช่น 081-234-5678" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project_name">ชื่องาน/โปรเจกต์</Label>
        <Input id="project_name" name="project_name" placeholder="เช่น โรงแรม XYZ ชั้น 3" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customer_type">กลุ่มลูกค้า</Label>
          <Select name="customer_type" required>
            <SelectTrigger id="customer_type" className="w-full">
              <SelectValue placeholder="เลือก" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project_type">ประเภทสถานที่</Label>
          <Select name="project_type" required>
            <SelectTrigger id="project_type" className="w-full">
              <SelectValue placeholder="เลือก" />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="stage">Stage</Label>
          <Select name="stage" required>
            <SelectTrigger id="stage" className="w-full">
              <SelectValue placeholder="เลือก" />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="est_value">มูลค่าโดยประมาณ (บาท)</Label>
          <Input id="est_value" name="est_value" type="number" min="0" step="1" placeholder="250000" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location_text">สถานที่ที่ไปพบลูกค้า</Label>
        <div className="flex gap-2">
          <Input
            id="location_text"
            name="location_text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="ลิงก์ Google Maps หรือพื้นที่"
          />
          <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={locating}>
            <MapPin className="h-4 w-4" />
            {locating ? "กำลังหา..." : "ตำแหน่งปัจจุบัน"}
          </Button>
        </div>
        {locationError && <p className="text-sm text-destructive">{locationError}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="next_action">Next Action</Label>
        <Input id="next_action" name="next_action" placeholder="เช่น นัดเสนองานใหม่ 20/7" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">หมายเหตุ</Label>
        <Textarea id="note" name="note" placeholder="รายละเอียดเพิ่มเติม" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="report_images">รูปภาพ (สูงสุด {MAX_IMAGES} รูป)</Label>
        <Input
          id="report_images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          disabled={resizing || images.length >= MAX_IMAGES}
        />
        {resizing && <p className="text-sm text-muted-foreground">กำลังปรับขนาดรูปภาพ...</p>}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {images.map((img, i) => (
              <div key={img.previewUrl} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable remote asset */}
                <img
                  src={img.previewUrl}
                  alt={`รูปที่ ${i + 1}`}
                  className="h-20 w-20 rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  aria-label="ลบรูปนี้"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" disabled={pending || resizing}>
        {pending ? "กำลังบันทึก..." : "บันทึก Sale Report"}
      </Button>
    </form>
  );
}
