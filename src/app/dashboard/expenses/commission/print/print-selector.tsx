"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE_VALUE = "__none__";

// toISOString() converts to UTC, which shifts the date backward a day in
// any timezone ahead of UTC (e.g. Thailand, UTC+7) — build the yyyy-mm-dd
// string from local date parts instead.
function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Default to the standard payout cycle (15th of last month through the
// nearest upcoming 15th) so the common case needs no editing — but both
// dates stay freely editable for any other range.
function defaultWindow(): { from: string; to: string } {
  const now = new Date();
  const to =
    now.getDate() <= 15
      ? new Date(now.getFullYear(), now.getMonth(), 15)
      : new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const from = new Date(to.getFullYear(), to.getMonth() - 1, 15);
  return { from: toLocalIso(from), to: toLocalIso(to) };
}

export function PrintSelector({ salesRepNames }: { salesRepNames: string[] }) {
  const router = useRouter();
  const [broker, setBroker] = useState("");
  const [dateFrom, setDateFrom] = useState(() => defaultWindow().from);
  const [dateTo, setDateTo] = useState(() => defaultWindow().to);

  const items = [
    { value: NONE_VALUE, label: "— เลือกพนักงานขาย/นายหน้า —" },
    ...salesRepNames.map((b) => ({ value: b, label: b })),
  ];

  function handleGenerate() {
    if (!broker || !dateFrom || !dateTo) return;
    router.push(
      `/dashboard/expenses/commission/print?broker=${encodeURIComponent(broker)}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    );
  }

  return (
    <div className="max-w-sm space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>พนักงานขาย/นายหน้า</Label>
        <Select
          value={broker || NONE_VALUE}
          onValueChange={(v) => setBroker(v === NONE_VALUE ? "" : ((v as string) ?? ""))}
          items={items}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="— เลือกพนักงานขาย/นายหน้า —" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
        ดึงรายการที่วันที่รับชำระอยู่ในช่วงวันที่เลือก (ค่าเริ่มต้นคือรอบจ่ายวันที่ 15 ของเดือนก่อนหน้าถึงวันที่ 15 นี้ ปรับได้ตามต้องการ)
      </p>
      <Button onClick={handleGenerate} disabled={!broker || !dateFrom || !dateTo}>
        ดูรายงาน
      </Button>
    </div>
  );
}
