"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteProjectSale, setProjectCancelled } from "./actions";

export function DangerZone({
  projectId,
  jobNo,
  isCancelled,
}: {
  projectId: string;
  jobNo: string | null;
  isCancelled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<"cancel" | "delete" | null>(null);

  function handleConfirmCancelToggle() {
    setError(null);
    startTransition(async () => {
      const result = await setProjectCancelled(projectId, jobNo, !isCancelled);
      if (result.error) setError(result.error);
      setConfirmingAction(null);
    });
  }

  function handleConfirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProjectSale(projectId);
      if (result.error) {
        setError(result.error);
        setConfirmingAction(null);
        return;
      }
      router.push("/dashboard/project-sales");
    });
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="h-4 w-4" />
          จัดการงานนี้
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}
        {isCancelled && (
          <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900">งานนี้ถูกยกเลิกแล้ว ไม่ถูกนับในยอดขาย</p>
        )}
        {confirmingAction ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm">
              {confirmingAction === "cancel"
                ? `ยืนยัน "${isCancelled ? "กู้คืนงานนี้" : "ยกเลิกงานนี้"}" ใช่หรือไม่?`
                : `ยืนยันลบงาน "${jobNo ?? ""}" ถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`}
            </p>
            <Button
              type="button"
              variant={confirmingAction === "delete" ? "destructive" : "outline"}
              onClick={confirmingAction === "cancel" ? handleConfirmCancelToggle : handleConfirmDelete}
              disabled={pending}
            >
              ยืนยัน
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmingAction(null)} disabled={pending}>
              ยกเลิก
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmingAction("cancel")}>
              {isCancelled ? <RotateCcw className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {isCancelled ? "กู้คืนงานนี้" : "ยกเลิกงานนี้"}
            </Button>
            <Button type="button" variant="destructive" onClick={() => setConfirmingAction("delete")}>
              <Trash2 className="h-4 w-4" />
              ลบงานนี้ถาวร
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
