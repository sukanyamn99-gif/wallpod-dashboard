"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoginLogEntry } from "@/lib/types";

export function ActivityLogTable({ entries }: { entries: LoginLogEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.fullNameSnapshot.toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q),
    );
  }, [entries, query]);

  const todayCount = entries.filter(
    (e) => new Date(e.loggedInAt).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium text-muted-foreground">การเข้าสู่ระบบทั้งหมด</p>
          <p className="text-2xl font-semibold">{entries.length}</p>
        </div>
        <div className="rounded-xl border bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">เข้าสู่ระบบวันนี้</p>
          <p className="text-2xl font-semibold">{todayCount}</p>
        </div>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาชื่อหรืออีเมล..."
        className="max-w-xs"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">ชื่อ-นามสกุล</TableHead>
              <TableHead className="whitespace-nowrap">อีเมล</TableHead>
              <TableHead className="whitespace-nowrap">เวลาเข้าสู่ระบบ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap font-medium">{e.fullNameSnapshot || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{e.email ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(e.loggedInAt).toLocaleString("th-TH")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {entries.length} รายการ
      </p>
    </div>
  );
}
