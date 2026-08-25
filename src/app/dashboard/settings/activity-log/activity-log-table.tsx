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
import type { ActivityLogEntry, LoginLogEntry } from "@/lib/types";

interface FeedEntry {
  id: string;
  actorName: string;
  isLogin: boolean;
  action: string;
  detail: string | null;
  createdAt: string;
}

export function ActivityLogTable({
  logins,
  actions,
}: {
  logins: LoginLogEntry[];
  actions: ActivityLogEntry[];
}) {
  const [query, setQuery] = useState("");

  const feed: FeedEntry[] = useMemo(() => {
    const loginEntries: FeedEntry[] = logins.map((e) => ({
      id: `login-${e.id}`,
      actorName: e.fullNameSnapshot || "—",
      isLogin: true,
      action: "เข้าสู่ระบบ",
      detail: e.email,
      createdAt: e.loggedInAt,
    }));
    const actionEntries: FeedEntry[] = actions.map((e) => ({
      id: `action-${e.id}`,
      actorName: e.actorNameSnapshot || "—",
      isLogin: false,
      action: e.action,
      detail: e.entityLabel,
      createdAt: e.createdAt,
    }));
    return [...loginEntries, ...actionEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [logins, actions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return feed;
    return feed.filter(
      (e) =>
        e.actorName.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.detail ?? "").toLowerCase().includes(q),
    );
  }, [feed, query]);

  const todayCount = feed.filter(
    (e) => new Date(e.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium text-muted-foreground">รายการทั้งหมด</p>
          <p className="text-2xl font-semibold">{feed.length}</p>
        </div>
        <div className="rounded-xl border bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">วันนี้</p>
          <p className="text-2xl font-semibold">{todayCount}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium text-muted-foreground">การเข้าสู่ระบบ / การกระทำสำคัญ</p>
          <p className="text-2xl font-semibold">
            {logins.length} / {actions.length}
          </p>
        </div>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาชื่อ, การกระทำ, หรือรายละเอียด..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">ผู้ใช้งาน</TableHead>
              <TableHead className="whitespace-nowrap">การกระทำ</TableHead>
              <TableHead className="whitespace-nowrap">รายละเอียด</TableHead>
              <TableHead className="whitespace-nowrap">เวลา</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap font-medium">{e.actorName}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={e.isLogin ? "secondary" : "destructive"}>{e.action}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{e.detail ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("th-TH")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {feed.length} รายการ
      </p>
    </div>
  );
}
