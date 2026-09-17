"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Eye, FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteDataDocument } from "./actions";
import { UploadDocumentDialog } from "./upload-document-dialog";
import type { DataDocument } from "@/lib/types";

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function DataDocumentsView({
  documents,
  signedUrls,
  canManage,
}: {
  documents: DataDocument[];
  signedUrls: Record<string, string>;
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
  }, [documents, search]);

  function handleDelete(id: string, title: string) {
    if (!window.confirm(`ลบเอกสาร "${title}" ถาวร?`)) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteDataDocument(id);
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">เอกสารข้อมูล</h1>
          <p className="text-sm text-muted-foreground">แคตตาล็อกและเอกสารต่างๆ สำหรับพนักงานดาวน์โหลด</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="ค้นหาเอกสาร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          {canManage && <UploadDocumentDialog />}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {documents.length === 0 ? "ยังไม่มีเอกสารในระบบ" : "ไม่พบเอกสารที่ค้นหา"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const thumbnailUrl = d.thumbnailPath ? signedUrls[d.thumbnailPath] : undefined;
            const fileUrl = signedUrls[d.filePath];
            return (
              <div key={d.id} className="overflow-hidden rounded-lg border">
                <div className="flex h-40 items-center justify-center bg-muted">
                  {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private signed URL, not an optimizable remote asset
                    <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{d.category}</Badge>
                    <span className="text-xs text-muted-foreground">{d.fileType}</span>
                  </div>
                  <p className="truncate font-medium" title={d.title}>
                    {d.title}
                  </p>
                  <p className="text-xs text-muted-foreground">ขนาดไฟล์: {formatFileSize(d.fileSizeBytes)}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      className="flex-1"
                      disabled={!fileUrl}
                      nativeButton={false}
                      render={<a href={fileUrl} download={d.title} />}
                    >
                      <Download className="h-4 w-4" />
                      ดาวน์โหลด
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!fileUrl}
                      nativeButton={false}
                      render={<a href={fileUrl} target="_blank" rel="noopener noreferrer" />}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={deletingId === d.id}
                        onClick={() => handleDelete(d.id, d.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
