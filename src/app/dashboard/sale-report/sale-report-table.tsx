"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, History, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { deleteSaleReport } from "./actions";
import type { Profile, SaleReport, SaleReportChangeLog, SalesRep, Stage } from "@/lib/types";

const STAGES: Stage[] = ["นำเสนอ", "ใบเสนอราคา", "เจรจาต่อรอง", "ปิดการขาย", "ไม่สำเร็จ"];

const TOTAL_COLUMNS = 14;

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

function canManage(report: SaleReport, profile: Profile) {
  return profile.role === "owner" || profile.role === "manager" || report.sales_rep_id === profile.sales_rep_id;
}

function RowActions({ report }: { report: SaleReport }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(`ยืนยันลบรายการของ "${report.customer_name}" ถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSaleReport(report.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <Button
          size="icon-sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/dashboard/sale-report/edit/${report.id}`} />}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-sm" variant="destructive" onClick={handleDelete} disabled={pending}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function DetailSheet({
  report,
  imageUrls,
  onOpenChange,
}: {
  report: SaleReport | null;
  imageUrls: Record<string, string>;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={report !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {report && (
          <>
            <SheetHeader>
              <SheetTitle>{report.customer_name}</SheetTitle>
              <SheetDescription>{report.project_name ?? "ไม่มีชื่องาน/โปรเจกต์"}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 overflow-y-auto px-4 pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{report.stage}</Badge>
                <span className="text-lg font-semibold">{formatTHB(report.est_value)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="เซลล์">{report.sales_rep_name}</DetailRow>
                <DetailRow label="วันที่บันทึก">{new Date(report.created_at).toLocaleString("th-TH")}</DetailRow>
                <DetailRow label="กลุ่มลูกค้า">{report.customer_type}</DetailRow>
                <DetailRow label="ประเภทสถานที่">{report.project_type}</DetailRow>
                <DetailRow label="ชื่อผู้ติดต่อ">{report.contact_name ?? "—"}</DetailRow>
                <DetailRow label="เบอร์โทร">
                  {report.phone ? (
                    <a href={`tel:${report.phone}`} className="text-primary underline underline-offset-2">
                      {report.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="ตำแหน่งที่ไปพบลูกค้า">
                  {report.location_text ? (
                    <a
                      href={report.location_text}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      ดูตำแหน่ง
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
              </div>

              <DetailRow label="Next Action">
                <p className="whitespace-pre-wrap">{report.next_action ?? "—"}</p>
              </DetailRow>

              <DetailRow label="หมายเหตุ">
                <p className="whitespace-pre-wrap">{report.note ?? "—"}</p>
              </DetailRow>

              <DetailRow label={`รูปภาพ (${report.image_paths.length})`}>
                {report.image_paths.length === 0 ? (
                  "—"
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {report.image_paths.map((path) =>
                      imageUrls[path] ? (
                        <a key={path} href={imageUrls[path]} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL, not an optimizable remote asset */}
                          <img
                            src={imageUrls[path]}
                            alt=""
                            className="aspect-square w-full rounded-md border object-cover"
                          />
                        </a>
                      ) : null,
                    )}
                  </div>
                )}
              </DetailRow>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChangeLogTable({ logs }: { logs: SaleReportChangeLog[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
        <History className="h-4 w-4" />
        {open ? "ซ่อนประวัติการแก้ไข/ลบ" : `ดูประวัติการแก้ไข/ลบ (${logs.length})`}
      </Button>

      {open && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">วันที่</TableHead>
                <TableHead className="whitespace-nowrap">การกระทำ</TableHead>
                <TableHead className="whitespace-nowrap">เซลล์</TableHead>
                <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
                <TableHead className="whitespace-nowrap">แก้ไขโดย</TableHead>
                <TableHead className="whitespace-nowrap">Stage ก่อนแก้ไข</TableHead>
                <TableHead className="text-right whitespace-nowrap">มูลค่าก่อนแก้ไข</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    ยังไม่มีประวัติการแก้ไข
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("th-TH")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={log.action === "delete" ? "destructive" : "secondary"}>
                      {log.action === "delete" ? "ลบ" : "แก้ไข"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{log.salesRepName}</TableCell>
                  <TableCell className="whitespace-nowrap">{log.customerName}</TableCell>
                  <TableCell className="whitespace-nowrap">{log.changedByName}</TableCell>
                  <TableCell className="whitespace-nowrap">{log.stageBefore}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatTHB(log.estValueBefore)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function SaleReportTable({
  reports,
  salesReps,
  imageUrls,
  currentProfile,
  changeLog,
}: {
  reports: SaleReport[];
  salesReps: SalesRep[];
  imageUrls: Record<string, string>;
  currentProfile: Profile;
  changeLog: SaleReportChangeLog[];
}) {
  const [selectedRep, setSelectedRep] = useState("all");
  const [viewingReport, setViewingReport] = useState<SaleReport | null>(null);

  const filtered = useMemo(() => {
    if (selectedRep === "all") return reports;
    return reports.filter((r) => r.sales_rep_id === selectedRep);
  }, [reports, selectedRep]);

  const summary = useMemo(() => summarize(filtered), [filtered]);

  return (
    <div className="space-y-6">
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
                <TableHead className="whitespace-nowrap">รายละเอียด</TableHead>
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
                  <TableCell>
                    <Button size="icon-sm" variant="outline" onClick={() => setViewingReport(r)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  <TableCell>{canManage(r, currentProfile) ? <RowActions report={r} /> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">
          แสดง {filtered.length} จาก {reports.length} รายการ
        </p>
      </div>

      <ChangeLogTable logs={changeLog} />

      <DetailSheet
        report={viewingReport}
        imageUrls={imageUrls}
        onOpenChange={(open) => !open && setViewingReport(null)}
      />
    </div>
  );
}
