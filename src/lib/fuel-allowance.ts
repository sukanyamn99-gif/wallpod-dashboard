// ค่าน้ำมันต่อเดือน — a sales rep reaches each tier by hitting its sales
// threshold OR its visit-count threshold (per the source policy's own
// "500,000 บาทขึ้นไป หรือวิ่งพบลูกค้า 50 รายขึ้นไป" wording), whichever
// comes first. Tier 0's minSales of 0 is the floor every rep reaches
// regardless of visit count — the source table has no 0-baht row.
export interface FuelAllowanceTier {
  amount: number;
  minSales: number;
  minVisits: number;
}

export const FUEL_ALLOWANCE_TIERS: FuelAllowanceTier[] = [
  { amount: 3000, minSales: 0, minVisits: 15 },
  { amount: 3500, minSales: 60_000, minVisits: 17 },
  { amount: 4000, minSales: 70_000, minVisits: 20 },
  { amount: 4500, minSales: 80_000, minVisits: 22 },
  { amount: 5000, minSales: 90_000, minVisits: 25 },
  { amount: 6000, minSales: 100_000, minVisits: 30 },
  { amount: 8000, minSales: 200_000, minVisits: 35 },
  { amount: 9000, minSales: 300_000, minVisits: 40 },
  { amount: 9000, minSales: 400_000, minVisits: 45 },
  { amount: 10000, minSales: 500_000, minVisits: 50 },
];

// Thresholds increase monotonically down the table, so the highest tier
// whose sales OR visit threshold is met is always the correct combined tier
// — no need to reconcile the two metrics separately.
export function calculateFuelAllowance(salesAmount: number, visitCount: number): FuelAllowanceTier {
  let result = FUEL_ALLOWANCE_TIERS[0];
  for (const tier of FUEL_ALLOWANCE_TIERS) {
    if (salesAmount >= tier.minSales || visitCount >= tier.minVisits) result = tier;
  }
  return result;
}
