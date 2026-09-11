"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approvePurchaseRequest, rejectPurchaseRequest } from "./actions";

export function RequestApprovalActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(action: (id: string) => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(requestId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => handle(approvePurchaseRequest)} disabled={pending}>
          <Check className="h-3.5 w-3.5" />
          อนุมัติ
        </Button>
        <Button size="sm" variant="destructive" onClick={() => handle(rejectPurchaseRequest)} disabled={pending}>
          <X className="h-3.5 w-3.5" />
          ไม่อนุมัติ
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
