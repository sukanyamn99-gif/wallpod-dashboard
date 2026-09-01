"use client";

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
  return (
    <div>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.close()}>
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
