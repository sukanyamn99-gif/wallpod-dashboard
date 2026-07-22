"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FilterX, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import type { Profile, StockMovement, StockProduct } from "@/lib/types";
import { RecordMovementDialog } from "./record-movement-dialog";

const TOTAL_COLUMNS = 10;

function inRange(dateStr: string, from: string, to: string) {
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function MovementsTable({
  movements,
  stockProducts,
  currentProfile,
}: {
  movements: StockMovement[];
  stockProducts: StockProduct[];
  currentProfile: Profile;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const canRecord =
    currentProfile.role === "owner" || currentProfile.role === "manager" || currentProfile.role === "production";

  const inCount = movements.filter((m) => m.movementType === "in").length;
  const outCount = movements.filter((m) => m.movementType === "out").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (type !== "all" && m.movementType !== type) return false;
      if (!inRange(m.createdAt, dateFrom, dateTo)) return false;
      if (!q) return true;
      return (
        m.productName.toLowerCase().includes(q) ||
        (m.productSku ?? "").toLowerCase().includes(q) ||
        (m.referenceNo ?? "").toLowerCase().includes(q) ||
        (m.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [movements, query, type, dateFrom, dateTo]);

  function clearFilters() {
    setQuery("");
    setType("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">IN</p>
          <p className="text-2xl font-semibold">{inCount}</p>
          <p className="text-xs text-muted-foreground">รายการ</p>
        </div>
        <div className="rounded-xl border bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">OUT</p>
          <p className="text-2xl font-semibold">{outCount}</p>
          <p className="text-xs text-muted-foreground">รายการ</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาสินค้าหรือเลขอ้างอิง..."
          className="max-w-xs"
        />
        <Select value={type} onValueChange={(v) => setType(v as string)} items={[{ value: "all", label: "ทุกประเภท" }, { value: "in", label: "IN" }, { value: "out", label: "OUT" }]}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="ทุกประเภท" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            <SelectItem value="in">IN</SelectItem>
            <SelectItem value="out">OUT</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
        <span className="text-sm text-muted-foreground">ถึง</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
        <Button variant="outline" onClick={() => router.refresh()}>
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href="/api/export-stock-movements" download />}>
          <Download className="h-4 w-4" />
          ส่งออก
        </Button>
        <Button variant="outline" onClick={clearFilters}>
          <FilterX className="h-4 w-4" />
          เคลียร์ตัวกรอง
        </Button>
        {canRecord && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            บันทึกความเคลื่อนไหว
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">วันที่/เวลา</TableHead>
              <TableHead className="whitespace-nowrap">ประเภท</TableHead>
              <TableHead className="whitespace-nowrap">รหัส</TableHead>
              <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
              <TableHead className="text-right whitespace-nowrap">จำนวน</TableHead>
              <TableHead className="text-right whitespace-nowrap">ก่อน</TableHead>
              <TableHead className="text-right whitespace-nowrap">หลัง</TableHead>
              <TableHead className="whitespace-nowrap">เอกสารอ้างอิง</TableHead>
              <TableHead className="whitespace-nowrap">ดำเนินการโดย</TableHead>
              <TableHead className="whitespace-nowrap">หมายเหตุ</TableHead>
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
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">{new Date(m.createdAt).toLocaleString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={m.movementType === "in" ? "secondary" : "destructive"}>
                    {m.movementType.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{m.productSku ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{m.productName}</TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatNumber(m.quantity)} {m.unit}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {m.balanceBefore === null ? "—" : formatNumber(m.balanceBefore)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {m.balanceAfter === null ? "—" : formatNumber(m.balanceAfter)}
                </TableCell>
                <TableCell className="whitespace-nowrap">{m.referenceNo ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{m.createdByName || "—"}</TableCell>
                <TableCell className="max-w-[16rem] whitespace-normal">{m.note ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {movements.length} รายการ
      </p>

      <RecordMovementDialog open={dialogOpen} onOpenChange={setDialogOpen} stockProducts={stockProducts} />
    </div>
  );
}
