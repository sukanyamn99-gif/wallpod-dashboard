"use client";

import { useState, useMemo, useTransition, type FormEvent } from "react";
import { Check, Eye, EyeOff, KeyRound, Lock, Trash2, User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, type Role, type UserAccount } from "@/lib/types";
import { deleteUserAccount, resetUserPassword } from "./actions";
import { EditUserDialog } from "./edit-user-dialog";

const TOTAL_COLUMNS = 7;

function roleBadgeVariant(role: Role): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  if (role === "manager") return "secondary";
  return "outline";
}

function DeleteUserButton({ account }: { account: UserAccount }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteUserAccount(account.id);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button
            size="icon-sm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
            title={`ยืนยันลบ "${account.fullName}" ถาวร`}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} title="ยกเลิก">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="max-w-[16rem] text-xs whitespace-normal text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="icon-sm" variant="destructive" onClick={() => setConfirming(true)} title="ลบผู้ใช้งาน">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="max-w-[16rem] text-xs whitespace-normal text-destructive">{error}</p>}
    </div>
  );
}

function ResetPasswordButton({ account }: { account: UserAccount }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function closeAndReset() {
    setOpen(false);
    setPassword("");
    setError(null);
    setSuccess(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resetUserPassword(account.id, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setPassword("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeAndReset())}>
      <DialogTrigger
        render={
          <Button size="icon-sm" variant="outline" title="รีเซ็ตรหัสผ่าน">
            <KeyRound className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-500" />
            รีเซ็ตรหัสผ่าน
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4 py-4">
            {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {success && (
              <p className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                ตั้งรหัสผ่านใหม่เรียบร้อย
              </p>
            )}
            <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">ผู้ใช้งาน</p>
                <p className="truncate text-sm font-medium">
                  {account.fullName}
                  {account.email && <span className="text-muted-foreground"> · {account.email}</span>}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`reset-password-${account.id}`}>
                รหัสผ่านใหม่ <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                <Input
                  id={`reset-password-${account.id}`}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  required
                  disabled={pending}
                  className="pr-9 pl-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAndReset} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending || password.length < 6}>
              <KeyRound className="h-4 w-4" />
              {pending ? "กำลังบันทึก..." : "รีเซ็ตรหัสผ่าน"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({
  account,
  isSelf,
  canManageAccounts,
}: {
  account: UserAccount;
  isSelf: boolean;
  canManageAccounts: boolean;
}) {
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
        <div className="flex gap-1">
          <EditUserDialog account={account} isSelf={isSelf} />
          {canManageAccounts && !isSelf && (
            <>
              <ResetPasswordButton account={account} />
              <DeleteUserButton account={account} />
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function UsersTable({
  accounts,
  currentUserId,
  canManageAccounts,
}: {
  accounts: UserAccount[];
  currentUserId: string;
  canManageAccounts: boolean;
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
        <div className="rounded-xl border bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">ผู้ดูแลระบบ</p>
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
              <UserRow key={a.id} account={a} isSelf={a.id === currentUserId} canManageAccounts={canManageAccounts} />
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
