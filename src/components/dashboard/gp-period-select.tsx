"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Picks the year the whole GP Dashboard is worked out for ("all" = every year).
// The choice lives in the URL (?year=) so a reload or a shared link keeps it.
export function GpPeriodSelect({ years, value }: { years: number[]; value: number | null }) {
  const router = useRouter();
  const items = [
    { value: "all", label: "ช่วงเวลา : ทุกปี" },
    ...years.map((y) => ({ value: String(y), label: `ช่วงเวลา : ปี ${y + 543}` })),
  ];

  return (
    <Select
      value={value === null ? "all" : String(value)}
      onValueChange={(v) => router.push(`/dashboard/gp?year=${v}`)}
      items={items}
    >
      <SelectTrigger className="h-10 w-56 gap-2 rounded-xl border-sky-400/30 bg-slate-900/60 px-3">
        <CalendarDays className="h-4 w-4 text-sky-300" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
