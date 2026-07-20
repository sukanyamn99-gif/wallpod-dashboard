"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { formatTHB } from "@/lib/format";
import type { SaleReport, SalesRep, Stage } from "@/lib/types";

const STAGES: Stage[] = ["นำเสนอ", "ใบเสนอราคา", "เจรจาต่อรอง", "ปิดการขาย", "ไม่สำเร็จ"];

const TOTAL_COLUMNS = 12;

function summarize(reports: SaleReport[]) {
  return {
    count: reports.length,
    totalEstValue: reports.reduce((sum, r) => sum + r.est_value, 0),
    byStage: STAGES.map((stage) => ({
      stage,
      count: reports.filter((r) => r.stage === stage).length,
    })),
  };
}

export function SaleReportTable({
  reports,
  salesReps,
  imageUrls,
}: {
  reports: SaleReport[];
  salesReps: SalesRep[];
  imageUrls: Record<string, string>;
}) {
  const [selectedRep, setSelectedRep] = useState("all");

  const filtered = useMemo(() => {
    if (selectedRep === "all") return reports;
    return reports.filter((r) => r.sales_rep_id === selectedRep);
  }, [reports, selectedRep]);

  const summary = useMemo(() => summarize(filtered), [filtered]);

  return (
    <div className="space-y-4">
      <Select
        value={selectedRep}
        onValueChange={(v) => setSelectedRep(v as string)}
        items={[{ value: "all", label: "ทั้งหมด" }, ...salesReps.map((r) => ({ value: r.id, label: r.name }))]}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="ทั้งหมด" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทั้งหมด</SelectItem>
          {salesReps.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm sm:grid-cols-4 lg:grid-cols-7">
        <div>
          <p className="text-muted-foreground">จำนวนรายการ</p>
          <p className="font-medium">{summary.count} รายการ</p>
        </div>
        <div>
          <p className="text-muted-foreground">มูลค่าโดยประมาณรวม</p>
          <p className="font-medium">{formatTHB(summary.totalEstValue)}</p>
        </div>
        {summary.byStage.map(({ stage, count }) => (
          <div key={stage}>
            <p className="text-muted-foreground">{stage}</p>
            <p className="font-medium">{count} รายการ</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">เซลล์</TableHead>
              <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
              <TableHead className="whitespace-nowrap">งาน/โปรเจกต์</TableHead>
              <TableHead className="whitespace-nowrap">กลุ่มลูกค้า</TableHead>
              <TableHead className="whitespace-nowrap">Stage</TableHead>
              <TableHead className="text-right whitespace-nowrap">มูลค่าโดยประมาณ</TableHead>
              <TableHead className="whitespace-nowrap">เบอร์โทร</TableHead>
              <TableHead className="whitespace-nowrap">ตำแหน่ง</TableHead>
              <TableHead className="whitespace-nowrap">รูปภาพ</TableHead>
              <TableHead className="whitespace-nowrap">Next Action</TableHead>
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
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("th-TH")}
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">{r.sales_rep_name}</TableCell>
                <TableCell className="whitespace-nowrap">{r.customer_name}</TableCell>
                <TableCell className="whitespace-nowrap">{r.project_name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.customer_type}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="secondary">{r.stage}</Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(r.est_value)}</TableCell>
                <TableCell className="whitespace-nowrap">{r.phone ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.location_text ? (
                    <a
                      href={r.location_text}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      ดูตำแหน่ง
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {r.image_paths.length === 0 ? (
                    "—"
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.image_paths.map((path) =>
                        imageUrls[path] ? (
                          <a key={path} href={imageUrls[path]} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL, not an optimizable remote asset */}
                            <img
                              src={imageUrls[path]}
                              alt=""
                              className="h-10 w-10 rounded border object-cover"
                            />
                          </a>
                        ) : null,
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.next_action ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.note ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {reports.length} รายการ
      </p>
    </div>
  );
}
