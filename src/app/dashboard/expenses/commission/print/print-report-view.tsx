"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PrintCommissionView } from "./print-commission-view";
import type { CommissionableProject } from "@/lib/types";

export function PrintReportView({
  brokers,
  windowStart,
  windowEnd,
  projects,
}: {
  brokers: string[];
  windowStart: string;
  windowEnd: string;
  projects: CommissionableProject[];
}) {
  const router = useRouter();

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        {/* Reached via router.push from the main commission page (same tab,
            not a script-opened window), so window.close() is a silent no-op
            — go back to where "พิมพ์รายงาน" was clicked from instead. */}
        <Button variant="outline" onClick={() => router.back()}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
      </div>
      {brokers.map((broker, i) => (
        <div key={broker} className={i < brokers.length - 1 ? "break-after-page" : ""}>
          <PrintCommissionView broker={broker} windowStart={windowStart} windowEnd={windowEnd} projects={projects} />
        </div>
      ))}
    </div>
  );
}
