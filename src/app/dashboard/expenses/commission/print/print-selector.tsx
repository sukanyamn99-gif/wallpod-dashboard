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

function defaultPayDate(): string {
  const now = new Date();
  // Nearest upcoming 15th, matching this payout cycle's own rule.
  const target = now.getDate() <= 15 ? new Date(now.getFullYear(), now.getMonth(), 15) : new Date(now.getFullYear(), now.getMonth() + 1, 15);
  return target.toISOString().slice(0, 10);
}

export function PrintSelector({ brokerNames }: { brokerNames: string[] }) {
  const router = useRouter();
  const [broker, setBroker] = useState("");
  const [payDate, setPayDate] = useState(defaultPayDate());

  const items = [{ value: NONE_VALUE, label: "— เลือกพนักงานขาย/นายหน้า —" }, ...brokerNames.map((b) => ({ value: b, label: b }))];

  function handleGenerate() {
    if (!broker || !payDate) return;
    router.push(`/dashboard/expenses/commission/print?broker=${encodeURIComponent(broker)}&payDate=${payDate}`);
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
      <div className="space-y-2">
        <Label>วันที่จ่าย (ทุกวันที่ 15)</Label>
        <DateInput value={payDate} onChange={setPayDate} />
        <p className="text-xs text-muted-foreground">
          ดึงรายการที่วันที่รับชำระอยู่ระหว่างวันที่ 15 ของเดือนก่อนหน้า ถึงวันที่จ่ายนี้
        </p>
      </div>
      <Button onClick={handleGenerate} disabled={!broker || !payDate}>
        ดูรายงาน
      </Button>
    </div>
  );
}
