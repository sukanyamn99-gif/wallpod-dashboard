"use client";

import Link from "next/link";
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
import type { Project, SaleReport } from "@/lib/types";

export interface ProjectDrillDown {
  kind: "projects";
  title: string;
  rows: Project[];
}

export interface SaleReportDrillDown {
  kind: "saleReports";
  title: string;
  rows: SaleReport[];
}

export type DrillDown = ProjectDrillDown | SaleReportDrillDown;

// Clicking any chart segment on the Sales Dashboard opens this dialog with
// the underlying job/lead rows that make up that segment's number, so the
// chart isn't just a summary — it's a way to get to the actual work behind it.
export function DrillDownDialog({ drillDown, onClose }: { drillDown: DrillDown | null; onClose: () => void }) {
  return (
    <Dialog open={drillDown !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {drillDown?.title} ({drillDown?.rows.length ?? 0} รายการ)
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            {drillDown?.kind === "projects" && <ProjectDrillDownTable rows={drillDown.rows} />}
            {drillDown?.kind === "saleReports" && <SaleReportDrillDownTable rows={drillDown.rows} />}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDrillDownTable({ rows }: { rows: Project[] }) {
  const sorted = rows
    .slice()
    .sort((a, b) => (a.job_no ?? "").localeCompare(b.job_no ?? "", undefined, { numeric: true }));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="whitespace-nowrap">JOB NO.</TableHead>
          <TableHead className="whitespace-nowrap">วันที่</TableHead>
          <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
          <TableHead className="whitespace-nowrap">ชื่องาน</TableHead>
          <TableHead className="whitespace-nowrap">เซลล์</TableHead>
          <TableHead className="whitespace-nowrap">สถานะ</TableHead>
          <TableHead className="text-right whitespace-nowrap">มูลค่า</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              ไม่พบข้อมูล
            </TableCell>
          </TableRow>
        )}
        {sorted.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="whitespace-nowrap font-medium">
              {p.job_no ? (
                <Link
                  href={`/dashboard/project-sales/edit/${encodeURIComponent(p.job_no)}`}
                  className="underline underline-offset-2"
                >
                  {p.job_no}
                </Link>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">{p.project_date}</TableCell>
            <TableCell className="whitespace-nowrap">{p.customer_name}</TableCell>
            <TableCell className="whitespace-nowrap">{p.project_name}</TableCell>
            <TableCell className="whitespace-nowrap">{p.sales_rep_name}</TableCell>
            <TableCell className="whitespace-nowrap">{p.production_status ?? "—"}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatTHB(p.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SaleReportDrillDownTable({ rows }: { rows: SaleReport[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="whitespace-nowrap">วันที่</TableHead>
          <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
          <TableHead className="whitespace-nowrap">ชื่องาน</TableHead>
          <TableHead className="whitespace-nowrap">เซลล์</TableHead>
          <TableHead className="whitespace-nowrap">ขั้นตอนถัดไป</TableHead>
          <TableHead className="text-right whitespace-nowrap">มูลค่าประเมิน</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              ไม่พบข้อมูล
            </TableCell>
          </TableRow>
        )}
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap">
              {new Date(r.created_at).toLocaleDateString("th-TH")}
            </TableCell>
            <TableCell className="whitespace-nowrap">{r.customer_name}</TableCell>
            <TableCell className="whitespace-nowrap">{r.project_name ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap">{r.sales_rep_name}</TableCell>
            <TableCell className="whitespace-nowrap">{r.next_action ?? "—"}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatTHB(r.est_value)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
