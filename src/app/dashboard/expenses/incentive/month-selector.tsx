"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IncentiveNameAutocomplete } from "@/components/dashboard/incentive-name-autocomplete";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const NAMES_STORAGE_KEY = "incentive-recipient-names";

export function MonthSelector() {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [beYear, setBeYear] = useState(String(now.getFullYear() + 543));
  // Who the ค่า Incentive pool splits across for this report — freely
  // typed in per generation, not tied to any role in the system (this
  // "ทีม Support" is a different notion of "support" than profiles.role).
  // Remembered in localStorage so the same names stay filled in next time
  // this page is opened, until the user edits them — most months use the
  // same people, so re-typing every time is pure friction.
  const [names, setNames] = useState<string[]>(() => {
    if (typeof window === "undefined") return [""];
    try {
      const saved = JSON.parse(window.localStorage.getItem(NAMES_STORAGE_KEY) ?? "null");
      return Array.isArray(saved) && saved.length > 0 ? saved : [""];
    } catch {
      return [""];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(NAMES_STORAGE_KEY, JSON.stringify(names));
    } catch {
      // localStorage unavailable (private browsing, etc.) — remembering
      // names is a convenience, not a requirement, so fail silently.
    }
  }, [names]);

  const monthItems = THAI_MONTHS.map((label, i) => ({ value: String(i + 1), label }));
  const validNames = names.map((n) => n.trim()).filter(Boolean);

  function updateName(i: number, value: string) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }
  function addName() {
    setNames((prev) => [...prev, ""]);
  }
  function removeName(i: number) {
    setNames((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function handleGenerate() {
    const year = Number(beYear) - 543;
    if (!month || !year) return;
    const namesParam = validNames.length > 0 ? `&names=${encodeURIComponent(validNames.join(","))}` : "";
    router.push(`/dashboard/expenses/incentive/print?month=${month}&year=${year}${namesParam}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="incentive_month">เดือน</Label>
          <Select value={month} onValueChange={(v) => setMonth((v as string) ?? month)} items={monthItems}>
            <SelectTrigger id="incentive_month" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="incentive_year">ปี (พ.ศ.)</Label>
          <NumberInput id="incentive_year" value={beYear} onChange={setBeYear} placeholder="2569" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        ดึงรายการงานขายจาก WALLPOD Project Sales ตามวันที่ของงานในเดือนที่เลือก
      </p>

      <div className="max-w-md space-y-2">
        <Label>ผู้รับค่า Incentive (แบ่งเท่ากันตามจำนวนคนที่กรอก)</Label>
        <div className="space-y-2">
          {names.map((name, i) => (
            <div key={i} className="flex gap-2">
              <IncentiveNameAutocomplete
                value={name}
                onChange={(v) => updateName(i, v)}
                placeholder={`ชื่อคนที่ ${i + 1}`}
              />
              {names.length > 1 && (
                <Button type="button" variant="outline" size="icon" onClick={() => removeName(i)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addName}>
          <Plus className="h-4 w-4" />
          เพิ่มคน
        </Button>
      </div>

      <Button onClick={handleGenerate} disabled={!month || !beYear}>
        ดูรายงาน
      </Button>
    </div>
  );
}
