"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import type { PayableRow, PayablesDashboardData } from "@/lib/data/payables";

const CATEGORICAL_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { count?: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label ?? entry.name}</p>
      <p className="text-muted-foreground">{formatTHB(entry.value)}</p>
      {entry.payload.count !== undefined && (
        <p className="text-xs text-muted-foreground">{entry.payload.count} ใบ</p>
      )}
    </div>
  );
}

export function PayablesBySupplierChart({
  data,
  list,
}: {
  data: PayablesDashboardData["bySupplier"];
  list: PayableRow[];
}) {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const rowsForSelected = selectedSupplier
    ? list.filter((r) => (r.supplierName ?? "ไม่ระบุผู้จำหน่าย") === selectedSupplier)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>เจ้าหนี้รายผู้จำหน่าย (Top 8)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatTHB(v)}
            />
            <YAxis
              type="category"
              dataKey="supplierName"
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar
              dataKey="amount"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
              cursor="pointer"
              onClick={(entry) =>
                setSelectedSupplier((entry.payload as PayablesDashboardData["bySupplier"][number]).supplierName)
              }
            >
              {data.map((entry, i) => (
                <Cell key={entry.supplierName} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>

      <Dialog open={selectedSupplier !== null} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSupplier} ({rowsForSelected.length} ใบ)
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="max-h-[60vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
                    <TableHead className="whitespace-nowrap">วันที่</TableHead>
                    <TableHead className="text-right whitespace-nowrap">ยอดเงิน</TableHead>
                    <TableHead className="text-right whitespace-nowrap">ค้างมา (วัน)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsForSelected.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        <Link
                          href={`/dashboard/goods-receipt/view/${r.id}`}
                          className="underline underline-offset-2"
                        >
                          {r.docNo}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString("th-TH")}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatTHB(r.totalAmount)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{r.ageDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
