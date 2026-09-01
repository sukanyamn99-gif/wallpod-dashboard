"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateQuotationStatus, convertQuotationToProjectSale } from "../actions";
import type { QuotationStatus } from "@/lib/types";

export function QuotationStatusActions({ quotationId, status }: { quotationId: string; status: QuotationStatus }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(next: QuotationStatus) {
    startTransition(async () => {
      await updateQuotationStatus(quotationId, next);
      router.refresh();
    });
  }

  function convert() {
    startTransition(async () => {
      const result = await convertQuotationToProjectSale(quotationId);
      if (!result.error) router.push(`/dashboard/project-sales/new?fromQuotation=${quotationId}`);
    });
  }

  if (status === "รอตอบรับ") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={convert} disabled={pending}>
          ลูกค้าตอบตกลง — แปลงเป็น Project Sales
        </Button>
        <Button size="sm" variant="outline" onClick={() => setStatus("ปฏิเสธ")} disabled={pending}>
          ลูกค้าปฏิเสธ
        </Button>
      </div>
    );
  }

  if (status === "ปฏิเสธ") {
    return (
      <Button size="sm" variant="outline" onClick={() => setStatus("รอตอบรับ")} disabled={pending}>
        เปลี่ยนกลับเป็นรอตอบรับ
      </Button>
    );
  }

  // ลูกค้าตอบตกลง — already accepted; offer the convert action again in
  // case the user navigated away from /project-sales/new before saving.
  return (
    <Button size="sm" variant="outline" onClick={convert} disabled={pending}>
      ไปที่ Project Sales (แปลงอีกครั้ง)
    </Button>
  );
}
