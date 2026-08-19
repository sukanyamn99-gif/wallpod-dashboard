"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Download, PackageSearch, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  MonthlyTrendChart,
  MovementSummaryChart,
  StockByCategoryChart,
  TopRequisitionedProductsChart,
} from "@/components/dashboard/stock-charts";
import { formatTHB } from "@/lib/format";
import type { StockDashboardData, StockMovement } from "@/lib/types";
import type { RequisitionItemReportRow } from "@/lib/data/stock-requisitions";

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function inRange(dateStr: string, from: string, to: string) {
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function monthKeyOf(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(key: string) {
  const [year, month] = key.split("-").map(Number);
  return `${THAI_MONTHS[month - 1]} ${String(year).slice(2)}`;
}

export function InventoryReportView({
  dashboardData,
  movements,
  requisitionItems,
  canSeeCosts,
}: {
  dashboardData: StockDashboardData;
  movements: StockMovement[];
  requisitionItems: RequisitionItemReportRow[];
  canSeeCosts: boolean;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredMovements = useMemo(
    () => movements.filter((m) => inRange(m.createdAt, dateFrom, dateTo)),
    [movements, dateFrom, dateTo],
  );
  const filteredItems = useMemo(
    () => requisitionItems.filter((r) => inRange(r.createdAt, dateFrom, dateTo)),
    [requisitionItems, dateFrom, dateTo],
  );

  const avgValuePerItem = dashboardData.skuCount > 0 ? dashboardData.totalStockValue / dashboardData.skuCount : 0;

  const requisitionCountTrend = useMemo(() => {
    const byMonth = new Map<string, Set<string>>();
    for (const item of filteredItems) {
      const key = monthKeyOf(item.createdAt);
      if (!byMonth.has(key)) byMonth.set(key, new Set());
      byMonth.get(key)!.add(item.requisitionId);
    }
    return Array.from(byMonth.keys())
      .sort()
      .map((key) => ({ monthLabel: monthLabelOf(key), value: byMonth.get(key)!.size }));
  }, [filteredItems]);

  const requisitionQuantityTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const item of filteredItems) {
      const key = monthKeyOf(item.createdAt);
      byMonth.set(key, (byMonth.get(key) ?? 0) + item.quantity);
    }
    return Array.from(byMonth.keys())
      .sort()
      .map((key) => ({ monthLabel: monthLabelOf(key), value: byMonth.get(key)! }));
  }, [filteredItems]);

  const topProducts = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const item of filteredItems) {
      byProduct.set(item.productName, (byProduct.get(item.productName) ?? 0) + item.quantity);
    }
    return Array.from(byProduct.entries())
      .map(([productName, quantity]) => ({ productName, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [filteredItems]);

  const movementSummary = useMemo(() => {
    const inCount = filteredMovements.filter((m) => m.movementType === "in").length;
    const outCount = filteredMovements.filter((m) => m.movementType === "out").length;
    return [
      { type: "in" as const, count: inCount },
      { type: "out" as const, count: outCount },
    ];
  }, [filteredMovements]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">ตั้งแต่</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">ถึง</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
        </div>
        <Button variant="outline" className="ml-auto" nativeButton={false} render={<a href="/api/export-stock-movements" download />}>
          <Download className="h-4 w-4" />
          ส่งออกรายงาน
        </Button>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${canSeeCosts ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
        <KpiCard label="สินค้าทั้งหมด" value={`${dashboardData.skuCount} รายการ`} icon={Boxes} tone="blue" />
        {canSeeCosts && (
          <>
            <KpiCard label="มูลค่าสินค้าคงคลัง" value={formatTHB(dashboardData.totalStockValue)} icon={PackageSearch} tone="green" />
            <KpiCard label="มูลค่าเฉลี่ย/รายการ" value={formatTHB(avgValuePerItem)} icon={Wallet} tone="violet" />
          </>
        )}
        <KpiCard label="สินค้าใกล้หมด" value={`${dashboardData.lowStockCount} รายการ`} icon={AlertTriangle} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MonthlyTrendChart title="แนวโน้มจำนวนใบเบิก (รายเดือน)" data={requisitionCountTrend} unitLabel="ใบเบิก" />
        <MonthlyTrendChart title="แนวโน้มจำนวนที่เบิก (รายเดือน)" data={requisitionQuantityTrend} unitLabel="หน่วย" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopRequisitionedProductsChart data={topProducts} />
        <MovementSummaryChart data={movementSummary} />
      </div>

      {canSeeCosts && <StockByCategoryChart data={dashboardData.categoryBreakdown} />}
    </div>
  );
}
