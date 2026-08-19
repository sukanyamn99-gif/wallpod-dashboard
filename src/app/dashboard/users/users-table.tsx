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
import { ROLE_LABELS, type Role, type UserAccount } from "@/lib/types";
import { EditUserDialog } from "./edit-user-dialog";

const TOTAL_COLUMNS = 7;

function roleBadgeVariant(role: Role): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  if (role === "manager") return "secondary";
  return "outline";
}

function UserRow({ account, isSelf }: { account: UserAccount; isSelf: boolean }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {account.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{account.fullName}</p>
            {isSelf && <p className="text-xs text-muted-foreground">คุณ</p>}
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{account.email ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant={roleBadgeVariant(account.role)}>{ROLE_LABELS[account.role]}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">{account.department || "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant={account.active ? "secondary" : "destructive"}>
          {account.active ? "ใช้งานอยู่" : "ระงับการใช้งาน"}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {new Date(account.createdAt).toLocaleDateString("th-TH")}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <EditUserDialog account={account} isSelf={isSelf} />
      </TableCell>
    </TableRow>
  );
}

export function UsersTable({
  accounts,
  currentUserId,
}: {
  accounts: UserAccount[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");

  const totalCount = accounts.length;
  const activeCount = accounts.filter((a) => a.active).length;
  const adminCount = accounts.filter((a) => a.role === "owner" || a.role === "manager").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.fullName.toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q),
    );
  }, [accounts, query]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium text-muted-foreground">ผู้ใช้ทั้งหมด</p>
          <p className="text-2xl font-semibold">{totalCount}</p>
        </div>
        <div className="rounded-xl border bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">ใช้งานอยู่</p>
          <p className="text-2xl font-semibold">{activeCount}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium text-muted-foreground">ผู้ดูแลระบบ</p>
          <p className="text-2xl font-semibold">{adminCount}</p>
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
              <TableHead className="whitespace-nowrap">สิทธิ์</TableHead>
              <TableHead className="whitespace-nowrap">แผนก</TableHead>
              <TableHead className="whitespace-nowrap">สถานะ</TableHead>
              <TableHead className="whitespace-nowrap">วันที่สร้าง</TableHead>
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
            {filtered.map((a) => (
              <UserRow key={a.id} account={a} isSelf={a.id === currentUserId} />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {accounts.length} ผู้ใช้งาน
      </p>
    </div>
  );
}
