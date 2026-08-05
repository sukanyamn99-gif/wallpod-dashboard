"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTHB } from "@/lib/format";
import { previewProjectImport, commitProjectImport, type ImportPreview } from "./import-actions";

export function ImportForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [previewPending, startPreview] = useTransition();
  const [commitPending, startCommit] = useTransition();

  function handleChooseFile() {
    setError(null);
    setPreview(null);
    setSuccessCount(null);
    setConfirmText("");
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    startPreview(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await previewProjectImport(fd);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPreview(result);
    });
  }

  function handleConfirm() {
    if (!preview) return;
    setError(null);
    startCommit(async () => {
      const result = await commitProjectImport(JSON.stringify(preview.rows));
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccessCount(result.count ?? preview.rows.length);
      setPreview(null);
      setConfirmText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  const confirmMatches = preview !== null && confirmText.trim() === String(preview.summary.rowCount);

  if (successCount !== null) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm">
            แทนที่ข้อมูลสำเร็จ — นำเข้า {successCount} งาน แทนที่ข้อมูลเดิมทั้งหมดเรียบร้อยแล้ว
          </p>
          <Button nativeButton={false} render={<Link href="/dashboard/project-sales" />}>
            ไปหน้ารายการ WALLPOD Project Sales
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>คำเตือนก่อนเริ่ม</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            การ import จะ<strong>ลบข้อมูลงานขายเดิมทั้งหมด</strong>แล้วแทนที่ด้วยข้อมูลในไฟล์ที่อัปโหลด
            การกระทำนี้ไม่สามารถย้อนกลับได้
          </p>
          <p className="flex items-start gap-2">
            <Download className="mt-0.5 h-4 w-4 shrink-0" />
            แนะนำให้กด &quot;Export Excel&quot; ที่หน้ารายการเพื่อสำรองข้อมูลปัจจุบันไว้ก่อน import
          </p>
          <p>ไฟล์ที่ใช้ import ต้องมีรูปแบบคอลัมน์เดียวกับไฟล์ที่ได้จากปุ่ม Export Excel</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>เลือกไฟล์ Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import_file">ไฟล์ (.xlsx)</Label>
            <Input
              id="import_file"
              type="file"
              accept=".xlsx"
              ref={fileInputRef}
              onChange={handleChooseFile}
              disabled={previewPending || commitPending}
            />
          </div>
          {previewPending && <p className="text-sm text-muted-foreground">กำลังตรวจสอบไฟล์...</p>}
          {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>ตรวจสอบข้อมูลก่อนยืนยัน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">จำนวนงาน</p>
                <p className="text-lg font-semibold">{preview.summary.rowCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">มูลค่ารวม (Pre-VAT)</p>
                <p className="text-lg font-semibold">{formatTHB(preview.summary.totalPreVat)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">ช่วงวันที่</p>
                <p className="text-lg font-semibold">
                  {preview.summary.dateFrom ?? "—"} ถึง {preview.summary.dateTo ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">ลูกค้า/เซลล์ใหม่</p>
                <p className="text-lg font-semibold">
                  {preview.summary.newCustomerNames.length + preview.summary.newSalesRepNames.length} รายการ
                </p>
              </div>
            </div>

            {preview.summary.newCustomerNames.length > 0 && (
              <p className="text-sm text-muted-foreground">
                ลูกค้าใหม่ที่จะถูกสร้าง: {preview.summary.newCustomerNames.join(", ")}
              </p>
            )}
            {preview.summary.newSalesRepNames.length > 0 && (
              <p className="text-sm text-muted-foreground">
                เซลล์ใหม่ที่จะถูกสร้าง: {preview.summary.newSalesRepNames.join(", ")}
              </p>
            )}

            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="mb-1 text-sm font-medium">คำเตือน ({preview.warnings.length})</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="confirm_count">
                พิมพ์ตัวเลข <strong>{preview.summary.rowCount}</strong> เพื่อยืนยันการแทนที่ข้อมูลทั้งหมด
              </Label>
              <Input
                id="confirm_count"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={String(preview.summary.rowCount)}
                className="max-w-[160px]"
                disabled={commitPending}
              />
              <Button
                variant="destructive"
                disabled={!confirmMatches || commitPending}
                onClick={handleConfirm}
              >
                <Upload className="h-4 w-4" />
                {commitPending ? "กำลังแทนที่ข้อมูล..." : "ยืนยันแทนที่ข้อมูลทั้งหมด"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
