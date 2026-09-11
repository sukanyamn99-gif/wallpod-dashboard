"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Banknote, Building2, Check, Pencil, Plus, Scale, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatTHB } from "@/lib/format";
import type { BankAccount } from "@/lib/types";
import { createBankAccount, deleteBankAccount, setBankAccountActive, updateBankAccount } from "./actions";

const addInitialState = { error: null as string | null };

function AddBankAccountForm() {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: typeof addInitialState, formData: FormData) => {
    const result = await createBankAccount(formData);
    if (!result.error) setFormKey((k) => k + 1);
    return result;
  }, addInitialState);

  return (
    <form
      key={formKey}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-dashed p-4"
      noValidate
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Plus className="h-4 w-4" />
        <span className="font-medium">เพิ่มบัญชีธนาคาร</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input name="bank_name" placeholder="ชื่อธนาคาร" required />
        <Input name="account_no" placeholder="เลขที่บัญชี" required />
        <Input name="account_type" placeholder="ประเภทบัญชี" defaultValue="กระแสรายวัน" />
        <Input name="account_name" placeholder="ชื่อบัญชี" defaultValue="บริษัท คูนเว จำกัด" />
        <Input name="opening_balance" type="number" step="0.01" placeholder="ยอดยกมา" defaultValue="0" />
        <Input name="actual_balance" type="number" step="0.01" placeholder="ยอดในธนาคาร" defaultValue="0" />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "กำลังบันทึก..." : "เพิ่มบัญชี"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function BankAccountCard({ account, canManage }: { account: BankAccount; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [bankName, setBankName] = useState(account.bankName);
  const [accountNo, setAccountNo] = useState(account.accountNo);
  const [accountType, setAccountType] = useState(account.accountType);
  const [accountName, setAccountName] = useState(account.accountName);
  const [openingBalance, setOpeningBalance] = useState(String(account.openingBalance));
  const [actualBalance, setActualBalance] = useState(String(account.actualBalance));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setBankName(account.bankName);
    setAccountNo(account.accountNo);
    setAccountType(account.accountType);
    setAccountName(account.accountName);
    setOpeningBalance(String(account.openingBalance));
    setActualBalance(String(account.actualBalance));
  }

  function handleSave() {
    if (!bankName.trim() || !accountNo.trim()) {
      setEditing(false);
      reset();
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("bank_name", bankName.trim());
      fd.set("account_no", accountNo.trim());
      fd.set("account_type", accountType.trim());
      fd.set("account_name", accountName.trim());
      fd.set("opening_balance", openingBalance);
      fd.set("actual_balance", actualBalance);
      const result = await updateBankAccount(account.id, fd);
      if (result.error) {
        setError(result.error);
        reset();
      }
      setEditing(false);
    });
  }

  function handleConfirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBankAccount(account.id);
      if (result.error) setError(result.error);
      setConfirmingDelete(false);
    });
  }

  function handleToggleActive(next: boolean) {
    startTransition(async () => {
      const result = await setBankAccountActive(account.id, next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--chart-1),transparent_86%)] text-[var(--chart-1)]">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-1">
          {canManage && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground" title="ใช้งานอยู่">
              <input
                type="checkbox"
                checked={account.active}
                onChange={(e) => handleToggleActive(e.target.checked)}
                disabled={pending}
                className="h-3.5 w-3.5"
              />
            </label>
          )}
          {canManage && (
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
              ) : confirmingDelete ? (
                <>
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    onClick={handleConfirmDelete}
                    disabled={pending}
                    title={`ยืนยันลบบัญชี "${account.bankName} ${account.accountNo}"`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={pending}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="icon-sm" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-2">
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="ชื่อธนาคาร" disabled={pending} autoFocus />
          <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="เลขที่บัญชี" disabled={pending} />
          <Input value={accountType} onChange={(e) => setAccountType(e.target.value)} placeholder="ประเภทบัญชี" disabled={pending} />
          <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="ชื่อบัญชี" disabled={pending} />
        </div>
      ) : (
        <div>
          <p className="font-medium">{account.bankName}</p>
          <p className="text-sm">{account.accountNo}</p>
          <p className="text-xs text-muted-foreground">
            {account.accountType} · {account.accountName}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="mt-1 space-y-1.5 border-t pt-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">ยอดในธนาคาร</span>
          {editing ? (
            <Input
              type="number"
              step="0.01"
              value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              className="h-7 w-32 text-right"
              disabled={pending}
            />
          ) : (
            <span className="font-medium">{formatTHB(account.actualBalance)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">ยอดในระบบ</span>
          <span className="font-medium">{formatTHB(account.systemBalance)}</span>
        </div>
        {editing && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">ยอดยกมา</span>
            <Input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="h-7 w-32 text-right"
              disabled={pending}
            />
          </div>
        )}
      </div>

      {!account.active && (
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          ไม่ได้ใช้งาน
        </span>
      )}
    </div>
  );
}

export function BankAccountCards({ accounts, canManage }: { accounts: BankAccount[]; canManage: boolean }) {
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const visible = useMemo(
    () => (showActiveOnly ? accounts.filter((a) => a.active) : accounts),
    [accounts, showActiveOnly],
  );

  const totalActualBalance = accounts.reduce((sum, a) => sum + a.actualBalance, 0);
  const totalSystemBalance = accounts.reduce((sum, a) => sum + a.systemBalance, 0);
  const lastUpdated = accounts
    .map((a) => a.actualBalanceUpdatedAt)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="ยอดคงเหลือทั้งหมดในธนาคาร" value={formatTHB(totalActualBalance)} icon={Banknote} tone="blue" />
        <KpiCard label="ยอดคงเหลือทั้งหมดในระบบ" value={formatTHB(totalSystemBalance)} icon={Scale} tone="green" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          บัญชีทั้งหมด {accounts.length} บัญชี
          {lastUpdated && ` · อัปเดตล่าสุด ${new Date(lastUpdated).toLocaleString("th-TH")}`}
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
            className="h-4 w-4"
          />
          แสดงเฉพาะบัญชีที่ใช้งาน
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((a) => (
          <BankAccountCard key={a.id} account={a} canManage={canManage} />
        ))}
        {canManage && <AddBankAccountForm />}
      </div>
      {visible.length === 0 && !canManage && (
        <p className="text-center text-sm text-muted-foreground">ยังไม่มีบัญชีธนาคารในระบบ</p>
      )}

      <p className="text-xs text-muted-foreground">
        * ยอดในระบบคำนวณจากรายการโอนเงินที่บันทึกไว้ในใบเสร็จรับเงินและใบสำคัญจ่ายที่ตรงกับชื่อธนาคารนี้ —
        เป็นยอดโดยประมาณ ไม่ใช่การกระทบยอดกับธนาคารจริง
      </p>
    </div>
  );
}
