"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteDataDocument } from "./actions";
import { UploadDocumentDialog } from "./upload-document-dialog";
import { DATA_DOCUMENT_CATEGORIES } from "@/lib/data-documents-constants";
import type { DataDocument } from "@/lib/types";

const ALL_CATEGORY = "ทั้งหมด";

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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Confirming via an in-app Dialog instead of window.confirm() — a native
  // confirm() dialog silently no-ops (returns false without ever showing)
  // in some browser/webview contexts, which read as "the delete button
  // does nothing" with no way to tell why.
  const [confirmTarget, setConfirmTarget] = useState<DataDocument | null>(null);

  // Union with the fixed category list so older documents saved under a
  // different category (e.g. the original free-text "เอกสาร" default,
  // before this filter existed) still get a reachable tab instead of
  // becoming invisible outside "ทั้งหมด".
  const categoryTabs = [
    ALL_CATEGORY,
    ...Array.from(new Set([...DATA_DOCUMENT_CATEGORIES, ...documents.map((d) => d.category)])),
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      const matchesCategory = activeCategory === ALL_CATEGORY || d.category === activeCategory;
      const matchesSearch = !q || d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [documents, search, activeCategory]);

  function confirmDelete() {
    const target = confirmTarget;
    if (!target) return;
    setConfirmTarget(null);
    setDeletingId(target.id);
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteDataDocument(target.id);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        // revalidatePath inside the action invalidates the server-side
        // cache, but this already-rendered client page needs its own
        // explicit refresh to actually re-fetch and show the change —
        // without this the delete succeeds silently and the row just sits
        // there until an unrelated navigation happens to reload it.
        router.refresh();
      }
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

      <div className="flex flex-wrap gap-2">
        {categoryTabs.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCategory(c)}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (activeCategory === c ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground")
            }
          >
            {c}
          </button>
        ))}
      </div>

      {deleteError && <p className="text-sm text-destructive">ลบไม่สำเร็จ: {deleteError}</p>}

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
                        onClick={() => setConfirmTarget(d)}
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

      <Dialog open={confirmTarget !== null} onOpenChange={(v) => !v && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบเอกสารนี้?</DialogTitle>
          </DialogHeader>
          <DialogBody className="pb-4">
            <p className="text-sm text-muted-foreground">
              ลบเอกสาร &quot;{confirmTarget?.title}&quot; ถาวร — ยกเลิกภายหลังไม่ได้
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              ลบเอกสาร
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
