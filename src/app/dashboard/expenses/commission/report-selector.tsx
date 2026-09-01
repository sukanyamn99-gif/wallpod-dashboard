"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";

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

  const allSelected = salesRepNames.length > 0 && salesRepNames.every((r) => selected.has(r));

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
    router.push(
      `/dashboard/expenses/commission/print?brokers=${encodeURIComponent(brokers)}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
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

      <Button onClick={handleGenerate} disabled={selected.size === 0 || !dateFrom || !dateTo}>
        ดูรายงาน{selected.size > 1 ? ` (${selected.size} คน)` : ""}
      </Button>
    </div>
  );
}
