"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
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
import { ROLE_LABELS, type Role, type UserAccount } from "@/lib/types";
import { updateUserAccount } from "./actions";

const TOTAL_COLUMNS = 7;

const ROLE_OPTIONS = (Object.entries(ROLE_LABELS) as [Role, string][]).map(([value, label]) => ({
  value,
  label,
}));

function roleBadgeVariant(role: Role): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  if (role === "manager") return "secondary";
  return "outline";
}

function UserRow({
  account,
  isSelf,
}: {
  account: UserAccount;
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Role>(account.role);
  const [department, setDepartment] = useState(account.department ?? "");
  const [active, setActive] = useState(account.active);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRole(account.role);
    setDepartment(account.department ?? "");
    setActive(account.active);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("role", role);
      fd.set("department", department.trim());
      if (active) fd.set("active", "on");
      const result = await updateUserAccount(account.id, fd);
      if (result.error) {
        setError(result.error);
        reset();
      }
      setEditing(false);
    });
  }

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
        {editing ? (
          isSelf ? (
            <Badge variant={roleBadgeVariant(account.role)}>{ROLE_LABELS[account.role]}</Badge>
          ) : (
            <Select value={role} onValueChange={(v) => setRole(v as Role)} items={ROLE_OPTIONS}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : (
          <Badge variant={roleBadgeVariant(account.role)}>{ROLE_LABELS[account.role]}</Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="แผนก"
            className="w-[130px]"
            disabled={pending}
          />
        ) : (
          account.department || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing && !isSelf ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 rounded border-input"
            />
            ใช้งานอยู่
          </label>
        ) : (
          <Badge variant={account.active ? "secondary" : "destructive"}>
            {account.active ? "ใช้งานอยู่" : "ระงับการใช้งาน"}
          </Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {new Date(account.createdAt).toLocaleDateString("th-TH")}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            {editing ? (
              <>
                <Button size="icon-sm" variant="outline" onClick={handleSave} disabled={pending}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    reset();
                  }}
                  disabled={pending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button size="icon-sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {editing && isSelf && (
            <p className="text-xs text-muted-foreground">ไม่สามารถแก้ไขสิทธิ์/สถานะของตัวเองได้</p>
          )}
        </div>
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
