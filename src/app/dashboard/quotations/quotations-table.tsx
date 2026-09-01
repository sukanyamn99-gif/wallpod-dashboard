"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Eye, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Quotation } from "@/lib/types";
import { formatTHB } from "@/lib/format";
import { deleteQuotation } from "./actions";

function statusVariant(status: Quotation["status"]): "secondary" | "destructive" | "outline" {
  if (status === "ลูกค้าตอบตกลง") return "secondary";
  if (status === "ปฏิเสธ") return "destructive";
  return "outline";
}

function DeleteButton({ quotation }: { quotation: Quotation }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteQuotation(quotation.id);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button size="icon-sm" variant="destructive" onClick={handleConfirm} disabled={pending} title={`ยืนยันลบใบเสนอราคา "${quotation.docNo}"`}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} title="ยกเลิก">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button size="icon-sm" variant="destructive" onClick={() => setConfirming(true)}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function QuotationsTable({ quotations }: { quotations: Quotation[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quotations;
    return quotations.filter(
      (r) =>
        r.docNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        (r.salesRepName ?? "").toLowerCase().includes(q),
    );
  }, [quotations, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่ใบเสนอราคา, ลูกค้า, ชื่อโครงการ..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
              <TableHead className="whitespace-nowrap">ชื่อโครงการ</TableHead>
              <TableHead className="whitespace-nowrap">พนักงานขาย</TableHead>
              <TableHead className="text-right whitespace-nowrap">ยอดรวม</TableHead>
              <TableHead className="whitespace-nowrap">สถานะ</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium whitespace-nowrap">{q.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(q.quoteDate).toLocaleDateString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">{q.customerName}</TableCell>
                <TableCell className="whitespace-nowrap">{q.projectName}</TableCell>
                <TableCell className="whitespace-nowrap">{q.salesRepName ?? "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(q.total)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(q.status)}>{q.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/quotations/view/${q.id}`} />}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/quotations/edit/${q.id}`} />}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <DeleteButton quotation={q} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {quotations.length} รายการ
      </p>
    </div>
  );
}
