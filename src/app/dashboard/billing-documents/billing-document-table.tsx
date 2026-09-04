"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { BILLING_DOCUMENT_LABELS } from "@/lib/types";
import type { BillingDocument, BillingDocumentType, Profile } from "@/lib/types";
import { deleteBillingDocument } from "./actions";

const TOTAL_COLUMNS = 6;

function canDelete(profile: Profile, doc: BillingDocument) {
  return profile.role === "owner" || profile.role === "manager" || doc.createdById === profile.id;
}

function DeleteButton({ docType, doc }: { docType: BillingDocumentType; doc: BillingDocument }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBillingDocument(docType, doc.id);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="icon-sm" variant="destructive" onClick={handleConfirm} disabled={pending} title={`ยืนยันลบ "${doc.docNo}"`}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
          <X className="h-3.5 w-3.5" />
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button size="icon-sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setConfirming(true); }}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function BillingDocumentTable({
  docType,
  documents,
  currentProfile,
}: {
  docType: BillingDocumentType;
  documents: BillingDocument[];
  currentProfile: Profile;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const routeSegment = docType.replace("_", "-");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.docNo.toLowerCase().includes(q) || d.customerName.toLowerCase().includes(q),
    );
  }, [documents, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขที่เอกสาร, ลูกค้า..."
          className="max-w-sm"
        />
        <Button nativeButton={false} render={<Link href={`/dashboard/billing-documents/${routeSegment}/new`} />}>
          <Plus className="h-4 w-4" />
          ออก{BILLING_DOCUMENT_LABELS[docType]}ใหม่
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ครบกำหนด</TableHead>
              <TableHead className="whitespace-nowrap">ผู้ขาย</TableHead>
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
            {filtered.map((doc) => (
              <TableRow
                key={doc.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/billing-documents/${routeSegment}/view/${doc.id}`)}
              >
                <TableCell className="font-medium whitespace-nowrap">{doc.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{doc.customerName}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(doc.docDate).toLocaleDateString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(doc.dueDate).toLocaleDateString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">{doc.salesRepName ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/billing-documents/${routeSegment}/view/${doc.id}`} />}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {/* Only ใบวางบิล/ใบแจ้งหนี้ have an edit route so far —
                        ใบกำกับภาษี/ใบเสร็จรับเงิน can be extended the same
                        way later if asked. */}
                    {(docType === "billing_note" || docType === "invoice") && canDelete(currentProfile, doc) && (
                      <Button
                        size="icon-sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/dashboard/billing-documents/${routeSegment}/edit/${doc.id}`} />}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete(currentProfile, doc) && <DeleteButton docType={docType} doc={doc} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {documents.length} รายการ
      </p>
    </div>
  );
}
