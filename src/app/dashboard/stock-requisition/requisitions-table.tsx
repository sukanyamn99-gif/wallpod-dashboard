"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
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
import { REQUISITION_PURPOSE_LABELS } from "@/lib/types";
import type { Profile, StockRequisition } from "@/lib/types";
import { deleteStockRequisition } from "./actions";

const TOTAL_COLUMNS = 8;

function canDelete(profile: Profile, requisition: Omit<StockRequisition, "items">) {
  return profile.role === "owner" || profile.role === "manager" || requisition.requestedById === profile.id;
}

function DeleteButton({ requisition }: { requisition: Omit<StockRequisition, "items"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !window.confirm(
        `ลบใบเบิก "${requisition.docNo}"? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะไม่คืนสต็อกที่เบิกไปแล้ว`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStockRequisition(requisition.id);
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

export function RequisitionsTable({
  requisitions,
  currentProfile,
}: {
  requisitions: Omit<StockRequisition, "items">[];
  currentProfile: Profile;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requisitions;
    return requisitions.filter(
      (r) =>
        r.docNo.toLowerCase().includes(q) ||
        (r.departmentName ?? "").toLowerCase().includes(q) ||
        r.requestedByName.toLowerCase().includes(q) ||
        (r.projectName ?? "").toLowerCase().includes(q),
    );
  }, [requisitions, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่เอกสาร, แผนก, ผู้เบิก..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">แผนก</TableHead>
              <TableHead className="whitespace-nowrap">ผู้เบิก</TableHead>
              <TableHead className="whitespace-nowrap">ชื่องาน</TableHead>
              <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
              <TableHead className="whitespace-nowrap">สถานะ</TableHead>
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
                <TableCell className="whitespace-nowrap">{r.departmentName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.requestedByName}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.projectName ?? "—"}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({REQUISITION_PURPOSE_LABELS[r.purpose]})
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.customerName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="secondary">{r.status}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString("th-TH")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/stock-requisition/view/${r.id}`} />}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete(currentProfile, r) && <DeleteButton requisition={r} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {requisitions.length} รายการ
      </p>
    </div>
  );
}
