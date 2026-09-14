"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { IncentiveNameAutocomplete } from "@/components/dashboard/incentive-name-autocomplete";

const SUPPORT_NAMES_STORAGE_KEY = "commission-support-names";

// toISOString() converts to UTC, which shifts the date backward a day in
// any timezone ahead of UTC (e.g. Thailand, UTC+7) — build the yyyy-mm-dd
// string from local date parts instead.
function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Default to the standard payout cycle (15th of last month through the
// nearest upcoming 15th) so the common case needs no editing — but both
// dates stay freely editable (typed directly, or via the calendar picker)
// for any other range.
function defaultWindow(): { from: string; to: string } {
  const now = new Date();
  const to =
    now.getDate() <= 15
      ? new Date(now.getFullYear(), now.getMonth(), 15)
      : new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const from = new Date(to.getFullYear(), to.getMonth() - 1, 15);
  return { from: toLocalIso(from), to: toLocalIso(to) };
}

export function ReportSelector({ salesRepNames }: { salesRepNames: string[] }) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(() => defaultWindow().from);
  const [dateTo, setDateTo] = useState(() => defaultWindow().to);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Support isn't one person — its commission pool splits equally across
  // whoever's named here, mirroring the Incentive report's identical
  // ผู้รับค่า Incentive pattern (same idea, same localStorage convention),
  // just scoped to this page instead of the Incentive one.
  const [supportNames, setSupportNames] = useState<string[]>(() => {
    if (typeof window === "undefined") return [""];
    try {
      const saved = JSON.parse(window.localStorage.getItem(SUPPORT_NAMES_STORAGE_KEY) ?? "null");
      return Array.isArray(saved) && saved.length > 0 ? saved : [""];
    } catch {
      return [""];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SUPPORT_NAMES_STORAGE_KEY, JSON.stringify(supportNames));
    } catch {
      // Remembering names is a convenience, not a requirement.
    }
  }, [supportNames]);

  const allSelected = salesRepNames.length > 0 && salesRepNames.every((r) => selected.has(r));
  const validSupportNames = supportNames.map((n) => n.trim()).filter(Boolean);

  function updateSupportName(i: number, value: string) {
    setSupportNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }
  function addSupportName() {
    setSupportNames((prev) => [...prev, ""]);
  }
  function removeSupportName(i: number) {
    setSupportNames((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(salesRepNames));
  }

  function toggleOne(rep: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rep)) next.delete(rep);
      else next.add(rep);
      return next;
    });
  }

  function handleGenerate() {
    if (selected.size === 0 || !dateFrom || !dateTo) return;
    const brokers = Array.from(selected).join(",");
    const supportNamesParam =
      selected.has("Support") && validSupportNames.length > 0
        ? `&supportNames=${encodeURIComponent(validSupportNames.join(","))}`
        : "";
    router.push(
      `/dashboard/expenses/commission/print?brokers=${encodeURIComponent(brokers)}&dateFrom=${dateFrom}&dateTo=${dateTo}${supportNamesParam}`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
        <div className="space-y-2">
          <Label>จากวันที่</Label>
          <DateInput value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="space-y-2">
          <Label>ถึงวันที่</Label>
          <DateInput value={dateTo} onChange={setDateTo} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        ดึงรายการที่วันที่รับชำระอยู่ในช่วงวันที่เลือก (ค่าเริ่มต้นคือรอบจ่ายวันที่ 15 ของเดือนก่อนหน้าถึงวันที่ 15 นี้ พิมพ์แก้ไขเองได้)
      </p>

      <div className="space-y-2">
        <Label>พนักงานขาย/นายหน้า (เลือกได้หลายคน)</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (allSelected ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground")
            }
          >
            เลือกทั้งหมด
          </button>
          {salesRepNames.map((rep) => (
            <button
              key={rep}
              type="button"
              onClick={() => toggleOne(rep)}
              className={
                "rounded-full border px-3 py-1 text-sm transition-colors " +
                (selected.has(rep) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground")
              }
            >
              {rep}
            </button>
          ))}
        </div>
      </div>

      {selected.has("Support") && (
        <div className="max-w-md space-y-2">
          <Label>สมาชิกทีม Support (แบ่งค่าคอมมิชชั่นเท่ากันตามจำนวนคนที่กรอก)</Label>
          <div className="space-y-2">
            {supportNames.map((name, i) => (
              <div key={i} className="flex gap-2">
                <IncentiveNameAutocomplete
                  value={name}
                  onChange={(v) => updateSupportName(i, v)}
                  placeholder={`ชื่อคนที่ ${i + 1}`}
                />
                {supportNames.length > 1 && (
                  <Button type="button" variant="outline" size="icon" onClick={() => removeSupportName(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addSupportName}>
            <Plus className="h-4 w-4" />
            เพิ่มคน
          </Button>
        </div>
      )}

      <Button onClick={handleGenerate} disabled={selected.size === 0 || !dateFrom || !dateTo}>
        ดูรายงาน{selected.size > 1 ? ` (${selected.size} คน)` : ""}
      </Button>
    </div>
  );
}
