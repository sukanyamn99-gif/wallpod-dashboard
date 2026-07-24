"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
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
import { ROLE_LABELS, type Role } from "@/lib/types";
import { createUserAccount } from "./actions";

const ROLE_OPTIONS = (Object.entries(ROLE_LABELS) as [Role, string][]).map(([value, label]) => ({
  value,
  label,
}));

const initialState: { error: string | null; needsConfirmation?: boolean } = { error: null };

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("sales");
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createUserAccount(formData);
    if (!result.error) {
      setFormKey((k) => k + 1);
      setRole("sales");
    }
    return result;
  }, initialState);

  const created = !state.error && state.needsConfirmation !== undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFormKey((k) => k + 1);
          setRole("sales");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="h-4 w-4" />
            เพิ่มผู้ใช้งาน
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่มผู้ใช้งานใหม่</DialogTitle>
        </DialogHeader>
        <form key={formKey} action={formAction}>
          <DialogBody className="space-y-4 py-4">
            {created ? (
              <p className="rounded-md bg-green-100 p-3 text-sm text-green-900">
                สร้างบัญชีเรียบร้อย —{" "}
                {state.needsConfirmation
                  ? "ผู้ใช้งานต้องกดยืนยันอีเมลก่อนเข้าสู่ระบบครั้งแรก"
                  : "ผู้ใช้งานสามารถเข้าสู่ระบบได้ทันที"}
              </p>
            ) : (
              <>
                {state.error && (
                  <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="full_name">ชื่อ-นามสกุล</Label>
                  <Input id="full_name" name="full_name" placeholder="ชื่อ นามสกุล" required disabled={pending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">อีเมล</Label>
                  <Input id="email" name="email" type="email" required disabled={pending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">รหัสผ่านเริ่มต้น</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      minLength={6}
                      required
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
                  <p className="text-xs text-muted-foreground">ผู้ใช้สามารถเปลี่ยนรหัสผ่านได้ภายหลัง</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">สิทธิ์การใช้งาน</Label>
                  <Select
                    name="role"
                    value={role}
                    onValueChange={(v) => setRole(v as Role)}
                    items={ROLE_OPTIONS}
                    disabled={pending}
                  >
                    <SelectTrigger id="role" className="w-full">
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">แผนก (ถ้ามี)</Label>
                  <Input id="department" name="department" placeholder="แผนก" disabled={pending} />
                </div>
                <p className="rounded-md bg-amber-100 p-3 text-xs text-amber-900">
                  ผู้ใช้งานใหม่จะเข้าสู่ระบบได้ทันทีหรือต้องยืนยันอีเมลก่อน ขึ้นอยู่กับการตั้งค่า &quot;Confirm
                  email&quot; ใน Supabase Auth Settings ของโปรเจกต์นี้
                </p>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            {created ? (
              <Button type="button" onClick={() => setOpen(false)}>
                เสร็จสิ้น
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "กำลังสร้าง..." : "สร้างผู้ใช้"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
