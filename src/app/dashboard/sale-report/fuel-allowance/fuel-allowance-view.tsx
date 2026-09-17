"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatTHB } from "@/lib/format";
import { FUEL_ALLOWANCE_TIERS } from "@/lib/fuel-allowance";
import type { FuelAllowanceRow } from "@/lib/types";

const ELIGIBLE_REPS_STORAGE_KEY = "fuel-allowance-eligible-reps";
// Only sales reps with a monthly sales quota get ค่าน้ำมัน — confirmed as
// อภิญญา and ธีรวัฒน์ when this page shipped. Kept editable (not hardcoded
// as a fixed filter) since who's eligible is a business decision that
// changes as reps join/leave the quota program, not something derivable
// from the sales data itself.
const DEFAULT_ELIGIBLE_REPS = ["อภิญญา (แนน)", "ธีรวัฒน์ (โต้)"];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function salesRangeLabel(index: number): string {
  const tier = FUEL_ALLOWANCE_TIERS[index];
  const next = FUEL_ALLOWANCE_TIERS[index + 1];
  if (!next) return `${formatNumber(tier.minSales)} บาทขึ้นไป`;
  return `${formatNumber(tier.minSales)}-${formatNumber(next.minSales - 1)} บาท`;
}

function visitRangeLabel(index: number): string {
  const tier = FUEL_ALLOWANCE_TIERS[index];
  const isLast = index === FUEL_ALLOWANCE_TIERS.length - 1;
  return isLast ? `${tier.minVisits} รายขึ้นไป` : `${tier.minVisits} ราย`;
}

export function FuelAllowanceView({
  rows,
  allNames,
  month,
  year,
}: {
  rows: FuelAllowanceRow[];
  allNames: string[];
  month: number;
  year: number;
}) {
  const router = useRouter();
  const [pendingMonth, setPendingMonth] = useState(String(month));
  const [pendingYear, setPendingYear] = useState(String(year + 543));

  // Persisted across visits so the eligible list doesn't need re-picking
  // every month — same convention as commission/incentive's remembered names.
  const [eligibleReps, setEligibleReps] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(DEFAULT_ELIGIBLE_REPS);
    try {
      const saved = JSON.parse(window.localStorage.getItem(ELIGIBLE_REPS_STORAGE_KEY) ?? "null");
      return Array.isArray(saved) ? new Set(saved) : new Set(DEFAULT_ELIGIBLE_REPS);
    } catch {
      return new Set(DEFAULT_ELIGIBLE_REPS);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(ELIGIBLE_REPS_STORAGE_KEY, JSON.stringify(Array.from(eligibleReps)));
    } catch {
      // Remembering the selection is a convenience, not a requirement.
    }
  }, [eligibleReps]);

  function toggleRep(name: string) {
    setEligibleReps((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const [newRepName, setNewRepName] = useState("");
  function addNewRep() {
    const name = newRepName.trim();
    if (!name) return;
    setEligibleReps((prev) => new Set(prev).add(name));
    setNewRepName("");
  }

  // Union of every name ever seen plus any custom name already added (e.g.
  // a brand-new rep with no sales/Sale Report history yet) — so both kinds
  // of reps render as a toggle-able chip, not just historical ones.
  const pickerNames = Array.from(new Set([...allNames, ...eligibleReps])).sort();

  // A rep marked eligible but with zero sales/visits this month still gets
  // a floor-tier row instead of silently vanishing from the report.
  const visibleRows = Array.from(eligibleReps)
    .map(
      (name) =>
        rows.find((r) => r.salesRepName === name) ?? {
          salesRepName: name,
          visitCount: 0,
          salesAmount: 0,
          fuelAmount: FUEL_ALLOWANCE_TIERS[0].amount,
        },
    )
    .sort((a, b) => b.fuelAmount - a.fuelAmount || b.salesAmount - a.salesAmount);

  const monthItems = THAI_MONTHS.map((label, i) => ({ value: String(i + 1), label }));

  function goToMonth(m: string, beYear: string) {
    const y = Number(beYear) - 543;
    if (!m || !y) return;
    router.push(`/dashboard/sale-report/fuel-allowance?month=${m}&year=${y}`);
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/dashboard/sale-report" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          กลับไปหน้า Sale Report
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">คำนวณค่าน้ำมันเซลล์</h1>
        <p className="text-sm text-muted-foreground">
          คำนวณตามยอดขายจริง (Koonway Project Sales) หรือจำนวนรายการ Sale Report ในเดือนนั้น — เลือกยอดที่สูงกว่าให้อัตโนมัติ
        </p>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>เลือกเดือน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
            <div className="space-y-2">
              <Label>เดือน</Label>
              <Select
                value={pendingMonth}
                onValueChange={(v) => {
                  const m = (v as string) ?? pendingMonth;
                  setPendingMonth(m);
                  goToMonth(m, pendingYear);
                }}
                items={monthItems}
              >
                <SelectTrigger className="w-full">
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
              <Label>ปี (พ.ศ.)</Label>
              <NumberInput
                value={pendingYear}
                onChange={(v) => {
                  setPendingYear(v);
                  goToMonth(pendingMonth, v);
                }}
                placeholder="2569"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>เซลล์ที่รับเป้าค่าน้ำมัน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            เลือกเฉพาะพนักงานขายที่รับเป้าและต้องจ่ายค่าน้ำมัน — คนอื่นในระบบจะไม่ถูกนำมาคำนวณ เลือกไว้ครั้งเดียว ระบบจะจำไว้ทุกครั้งที่เปิดหน้านี้
          </p>
          <div className="flex flex-wrap gap-2">
            {pickerNames.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีชื่อพนักงานขายในระบบ</p>}
            {pickerNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleRep(name)}
                className={
                  "rounded-full border px-3 py-1 text-sm transition-colors " +
                  (eligibleReps.has(name) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground")
                }
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex max-w-md gap-2">
            <Input
              placeholder="เพิ่มชื่อเซลล์ใหม่ (ยังไม่เคยมีข้อมูลในระบบ)"
              value={newRepName}
              onChange={(e) => setNewRepName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNewRep();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addNewRep} disabled={!newRepName.trim()}>
              <Plus className="h-4 w-4" />
              เพิ่ม
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            ค่าน้ำมันประจำเดือน {THAI_MONTHS[month - 1]} {year + 543}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>พนักงานขาย</TableHead>
                <TableHead className="text-right">ยอดขาย (บาท)</TableHead>
                <TableHead className="text-right">จำนวนลูกค้าที่วิ่ง</TableHead>
                <TableHead className="text-right">ค่าน้ำมันที่ได้รับ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    ยังไม่ได้เลือกเซลล์ที่รับเป้าค่าน้ำมัน — เลือกได้ที่การ์ด &quot;เซลล์ที่รับเป้าค่าน้ำมัน&quot; ด้านบน
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r) => (
                  <TableRow key={r.salesRepName}>
                    <TableCell className="font-medium">{r.salesRepName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTHB(r.salesAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.visitCount)} ราย</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatTHB(r.fuelAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>เกณฑ์การจ่ายค่าน้ำมัน (อ้างอิง)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ค่าน้ำมันที่ได้รับ</TableHead>
                <TableHead>ยอดขาย</TableHead>
                <TableHead>จำนวนลูกค้าที่วิ่ง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FUEL_ALLOWANCE_TIERS.map((tier, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{formatTHB(tier.amount)} บาท</TableCell>
                  <TableCell>{salesRangeLabel(i)}</TableCell>
                  <TableCell>{visitRangeLabel(i)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            ถึงเกณฑ์จากยอดขายหรือจำนวนลูกค้าที่วิ่งอย่างใดอย่างหนึ่งก็ได้ — ระบบจะเลือกขั้นที่สูงกว่าให้อัตโนมัติ
            พิจารณาเป็นรายเดือน ไม่มีการทบยอดข้ามเดือน
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          พิมพ์
        </Button>
      </div>
    </div>
  );
}
