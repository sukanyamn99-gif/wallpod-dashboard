"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import type { ProjectSummary } from "@/lib/data/project-sales";

export function ProjectsTable({ projects }: { projects: ProjectSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        (p.jobNo ?? "").toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        p.salesRepName.toLowerCase().includes(q),
    );
  }, [projects, query]);

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหา JOB NO. / ลูกค้า / ชื่องาน / เซลล์"
        className="max-w-sm"
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>JOB NO.</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>ลูกค้า</TableHead>
              <TableHead>ชื่องาน</TableHead>
              <TableHead>เซลล์</TableHead>
              <TableHead>กลุ่มลูกค้า</TableHead>
              <TableHead className="text-right">มูลค่ารวม</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id} className={p.isCancelled ? "opacity-60" : undefined}>
                <TableCell className="font-medium">
                  {p.jobNo ? (
                    <Link
                      href={`/dashboard/project-sales/edit/${encodeURIComponent(p.jobNo)}`}
                      className="underline underline-offset-2"
                    >
                      {p.jobNo}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{p.projectDate}</TableCell>
                <TableCell>{p.customerName}</TableCell>
                <TableCell>{p.projectName}</TableCell>
                <TableCell>{p.salesRepName}</TableCell>
                <TableCell>{p.customerType}</TableCell>
                <TableCell className="text-right">{formatTHB(p.total)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.isCancelled && <Badge variant="destructive">ยกเลิก</Badge>}
                    {p.status && <Badge variant="outline">{p.status}</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {projects.length} งาน
      </p>
    </div>
  );
}
