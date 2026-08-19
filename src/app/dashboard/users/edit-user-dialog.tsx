"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, type Role, type UserAccount } from "@/lib/types";
import { updateUserAccount } from "./actions";

const ROLE_OPTIONS = (Object.entries(ROLE_LABELS) as [Role, string][]).map(([value, label]) => ({
  value,
  label,
}));

function roleBadgeVariant(role: Role): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  if (role === "manager") return "secondary";
  return "outline";
}

const initialState: { error: string | null } = { error: null };

// Owns useActionState itself so remounting this component (via the `key` the
// parent gives it on close) fully resets it — see the same bug/fix in
// add-user-dialog.tsx: resetting only the <form> element left `state` (and
// any leftover error message) stuck across dialog reopens.
function EditUserForm({
  account,
  isSelf,
  onClose,
}: {
  account: UserAccount;
  isSelf: boolean;
  onClose: () => void;
}) {
  const [role, setRole] = useState<Role>(account.role);
  const [active, setActive] = useState(account.active);
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return updateUserAccount(account.id, formData);
  }, initialState);

  // Auto-close on a successful save — no separate "saved" screen needed here
  // since the table itself updates via revalidatePath; only errors need to
  // stay visible so the user can see and fix them.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onClose();
    wasPending.current = pending;
  }, [pending, state.error, onClose]);

  return (
    <form action={formAction}>
      <DialogBody className="space-y-4 py-4">
        {state.error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
        )}
        <div className="space-y-2">
          <Label htmlFor={`full_name-${account.id}`}>ชื่อ-นามสกุล</Label>
          <Input
            id={`full_name-${account.id}`}
            name="full_name"
            defaultValue={account.fullName}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`email-${account.id}`}>อีเมล</Label>
          <Input
            id={`email-${account.id}`}
            name="email"
            type="email"
            defaultValue={account.email ?? ""}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`role-${account.id}`}>สิทธิ์การใช้งาน</Label>
          {isSelf ? (
            <div>
              <Badge variant={roleBadgeVariant(account.role)}>{ROLE_LABELS[account.role]}</Badge>
              <input type="hidden" name="role" value={account.role} />
            </div>
          ) : (
            <Select name="role" value={role} onValueChange={(v) => setRole(v as Role)} items={ROLE_OPTIONS} disabled={pending}>
              <SelectTrigger id={`role-${account.id}`} className="w-full">
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
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`department-${account.id}`}>แผนก (ถ้ามี)</Label>
          <Input
            id={`department-${account.id}`}
            name="department"
            defaultValue={account.department ?? ""}
            placeholder="แผนก"
            disabled={pending}
          />
        </div>
        {isSelf ? (
          <p className="text-xs text-muted-foreground">ไม่สามารถแก้ไขสิทธิ์/สถานะของตัวเองได้</p>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 rounded border-input"
            />
            ใช้งานอยู่
          </label>
        )}
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor={`password-${account.id}`}>รีเซ็ตรหัสผ่าน</Label>
          <div className="relative">
            <Input
              id={`password-${account.id}`}
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={6}
              placeholder="เว้นว่างหากไม่ต้องการเปลี่ยนรหัสผ่าน"
              disabled={pending}
              className="pr-9"
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
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditUserDialog({ account, isSelf }: { account: UserAccount; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function closeAndReset() {
    setOpen(false);
    setFormKey((k) => k + 1);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger
        render={
          <Button size="icon-sm" variant="outline">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขผู้ใช้งาน — {account.fullName}</DialogTitle>
        </DialogHeader>
        <EditUserForm key={formKey} account={account} isSelf={isSelf} onClose={closeAndReset} />
      </DialogContent>
    </Dialog>
  );
}
