"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Drops into any print view next to its own "พิมพ์" button — reads its own
// current URL, so no per-page wiring beyond adding this one component. The
// actual PDF is rendered server-side (see /api/print-pdf) by re-navigating
// a headless browser to this same page with @media print active, reusing
// each view's already-tuned print CSS instead of a second render path.
export function DownloadPdfButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setPending(true);
    setError(null);
    try {
      // Include the query string too — some print views (e.g. petty cash's
      // date range) get their content entirely from search params, and
      // Puppeteer's fresh navigation on the server needs the exact same
      // URL to render the same content the button was clicked from.
      const path = window.location.pathname + window.location.search;
      const res = await fetch(`/api/print-pdf?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "สร้าง PDF ไม่สำเร็จ");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "document.pdf";
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้าง PDF ไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={handleDownload} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {pending ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
