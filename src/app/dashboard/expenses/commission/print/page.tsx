import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import {
  getCommissionEntriesForReport,
  getCommissionPayoutWindow,
  getDistinctBrokerNames,
  summarizeByBroker,
} from "@/lib/data/commission";
import { PrintCommissionView } from "./print-commission-view";
import { PrintSelector } from "./print-selector";

export default async function PrintCommissionPage({
  searchParams,
}: {
  searchParams: Promise<{ broker?: string; payDate?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/commission")) redirect("/dashboard/sales");

  const { broker, payDate } = await searchParams;

  if (!broker || !payDate) {
    const brokerNames = await getDistinctBrokerNames();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">พิมพ์รายงานค่าคอมมิชชั่น</h1>
          <p className="text-sm text-muted-foreground">เลือกพนักงานขาย/นายหน้า และรอบวันที่จ่าย</p>
        </div>
        <PrintSelector brokerNames={brokerNames} />
      </div>
    );
  }

  const { windowStart, windowEnd } = getCommissionPayoutWindow(payDate);
  const entries = await getCommissionEntriesForReport(windowStart, windowEnd);
  const brokerTotals = summarizeByBroker(entries);

  return (
    <PrintCommissionView
      broker={broker}
      windowStart={windowStart}
      windowEnd={windowEnd}
      entries={entries}
      brokerTotals={brokerTotals}
    />
  );
}
