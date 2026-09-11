"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Printer, Trash2, X } from "lucide-react";
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
import type { Profile, PurchaseRequest } from "@/lib/types";
import { deletePurchaseRequest } from "./actions";

const TOTAL_COLUMNS = 7;

function statusVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "อนุมัติ") return "secondary";
  if (status === "ไม่อนุมัติ") return "destructive";
  return "outline";
}

function canDelete(profile: Profile, request: Omit<PurchaseRequest, "items">) {
  return profile.role === "owner" || profile.role === "manager" || request.requestedById === profile.id;
}

function DeleteButton({ request }: { request: Omit<PurchaseRequest, "items"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deletePurchaseRequest(request.id);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button size="icon-sm" variant="destructive" onClick={handleConfirm} disabled={pending} title={`ยืนยันลบใบขอซื้อ "${request.docNo}"`}>
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
    <div className="flex flex-col gap-1">
      <Button size="icon-sm" variant="destructive" onClick={() => setConfirming(true)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PurchaseRequestsTable({
  requests,
  currentProfile,
}: {
  requests: Omit<PurchaseRequest, "items">[];
  currentProfile: Profile;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.docNo.toLowerCase().includes(q) ||
        (r.departmentName ?? "").toLowerCase().includes(q) ||
        r.requestedByName.toLowerCase().includes(q),
    );
  }, [requests, query]);

  return (
    <div className="space-y-4">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่เอกสาร, แผนก, ผู้ขอซื้อ..." className="max-w-sm" />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">แผนก</TableHead>
              <TableHead className="whitespace-nowrap">ผู้ขอซื้อ</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">สถานะ</TableHead>
              <TableHead className="whitespace-nowrap">ผู้อนุมัติ</TableHead>
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
              <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/purchase-requests/view/${r.id}`)}>
                <TableCell className="font-medium whitespace-nowrap">{r.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{r.departmentName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.requestedByName}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(r.requestDate).toLocaleDateString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.approvedByName ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/purchase-requests/view/${r.id}`} />}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/purchase-requests/print/${r.id}`} target="_blank" />}
                      title="พิมพ์"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete(currentProfile, r) && <DeleteButton request={r} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {requests.length} รายการ
      </p>
    </div>
  );
}
