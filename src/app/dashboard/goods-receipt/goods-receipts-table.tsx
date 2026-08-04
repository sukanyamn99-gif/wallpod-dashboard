"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
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
import type { GoodsReceipt, Profile } from "@/lib/types";
import { deleteGoodsReceipt } from "./actions";

const TOTAL_COLUMNS = 6;

function canDelete(profile: Profile, receipt: Omit<GoodsReceipt, "items">) {
  return profile.role === "owner" || profile.role === "manager" || receipt.receivedById === profile.id;
}

function DeleteButton({ receipt }: { receipt: Omit<GoodsReceipt, "items"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !window.confirm(
        `ลบใบรับสินค้า "${receipt.docNo}"? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะไม่คืนสต็อก/ต้นทุนที่รับเข้าไปแล้ว`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteGoodsReceipt(receipt.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="icon-sm" variant="destructive" onClick={handleDelete} disabled={pending}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function GoodsReceiptsTable({
  receipts,
  currentProfile,
}: {
  receipts: Omit<GoodsReceipt, "items">[];
  currentProfile: Profile;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) =>
        r.docNo.toLowerCase().includes(q) ||
        (r.supplierName ?? "").toLowerCase().includes(q) ||
        r.receivedByName.toLowerCase().includes(q) ||
        (r.referenceNo ?? "").toLowerCase().includes(q),
    );
  }, [receipts, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่เอกสาร, ผู้จำหน่าย, ผู้รับ..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">ผู้จำหน่าย</TableHead>
              <TableHead className="whitespace-nowrap">ผู้รับ</TableHead>
              <TableHead className="whitespace-nowrap">เลขที่อ้างอิง</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={TOTAL_COLUMNS} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium whitespace-nowrap">{r.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{r.supplierName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.receivedByName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.referenceNo ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString("th-TH")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/goods-receipt/view/${r.id}`} />}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete(currentProfile, r) && (
                      <Button
                        size="icon-sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/dashboard/goods-receipt/edit/${r.id}`} />}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete(currentProfile, r) && <DeleteButton receipt={r} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {receipts.length} รายการ
      </p>
    </div>
  );
}
