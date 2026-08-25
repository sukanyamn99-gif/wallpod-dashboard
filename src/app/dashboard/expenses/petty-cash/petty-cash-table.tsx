"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import type { PettyCashTransaction } from "@/lib/types";

const TOTAL_COLUMNS = 7;

export function PettyCashTable({ transactions }: { transactions: PettyCashTransaction[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) => t.docNo.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [transactions, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่เอกสาร, รายละเอียด..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ประเภท</TableHead>
              <TableHead className="whitespace-nowrap">รายละเอียด</TableHead>
              <TableHead className="text-right whitespace-nowrap">จำนวนเงิน</TableHead>
              <TableHead className="text-right whitespace-nowrap">คงเหลือ</TableHead>
              <TableHead className="whitespace-nowrap">ผู้บันทึก</TableHead>
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
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium whitespace-nowrap">{t.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(t.transactionDate).toLocaleDateString("th-TH")}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.transactionType === "topup" ? (
                    <Badge variant="secondary">เติมเงิน</Badge>
                  ) : (
                    <Badge variant="destructive">ใช้จ่าย</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{t.description}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {t.transactionType === "topup" ? "+" : "-"}
                  {formatTHB(t.amount)}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatTHB(t.balanceAfter)}
                </TableCell>
                <TableCell className="whitespace-nowrap">{t.recordedByName || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {transactions.length} รายการ
      </p>
    </div>
  );
}
