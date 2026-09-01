"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createRateTier, deleteRateTier, updateRateTier } from "./actions";
import type { CommissionRateTier } from "@/lib/types";

function AddTierForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");
  const [commissionRatePercent, setCommissionRatePercent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("discount_percent", discountPercent);
      fd.set("commission_rate_percent", commissionRatePercent);
      const result = await createRateTier(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDiscountPercent("");
      setCommissionRatePercent("");
      setOpen(false);
      onAdded();
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        เพิ่มอัตรา
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">อัตราส่วนลด (%)</label>
        <Input
          type="number"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          className="w-28"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">อัตราค่าคอมมิชชั่น (%)</label>
        <Input
          type="number"
          value={commissionRatePercent}
          onChange={(e) => setCommissionRatePercent(e.target.value)}
          className="w-28"
        />
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={pending}>
        บันทึก
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setDiscountPercent("");
          setCommissionRatePercent("");
          setError(null);
          setOpen(false);
        }}
        disabled={pending}
      >
        ยกเลิก
      </Button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TierRow({ tier }: { tier: CommissionRateTier }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(String(tier.discountPercent));
  const [commissionRatePercent, setCommissionRatePercent] = useState(String(tier.commissionRatePercent));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("discount_percent", discountPercent);
      fd.set("commission_rate_percent", commissionRatePercent);
      const result = await updateRateTier(tier.id, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleConfirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRateTier(tier.id);
      if (result.error) setError(result.error);
      setConfirmingDelete(false);
    });
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell>
          <Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="w-24" />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={commissionRatePercent}
            onChange={(e) => setCommissionRatePercent(e.target.value)}
            className="w-24"
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="outline" onClick={handleSave} disabled={pending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => {
                setDiscountPercent(String(tier.discountPercent));
                setCommissionRatePercent(String(tier.commissionRatePercent));
                setError(null);
                setEditing(false);
              }}
              disabled={pending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{tier.discountPercent.toFixed(2)}%</TableCell>
      <TableCell>{tier.commissionRatePercent.toFixed(2)}%</TableCell>
      <TableCell>
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="destructive" onClick={handleConfirmDelete} disabled={pending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon-sm" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={pending}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon-sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {error && !editing && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </TableCell>
    </TableRow>
  );
}

export function RateTiersTable({ tiers }: { tiers: CommissionRateTier[] }) {
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-3">
      <AddTierForm key={formKey} onAdded={() => setFormKey((k) => k + 1)} />
      <div className="max-w-md overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>อัตราส่วนลด</TableHead>
              <TableHead>อัตราค่าคอมมิชชั่น</TableHead>
              <TableHead>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  ยังไม่มีอัตราค่าคอมมิชชั่น
                </TableCell>
              </TableRow>
            )}
            {tiers.map((tier) => (
              <TierRow key={tier.id} tier={tier} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
