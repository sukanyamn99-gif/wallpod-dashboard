import type { PurchaseRequest } from "@/lib/types";

// Who may edit a ใบขอซื้อ — mirrors the database policy in migration_096:
//  - the requester, but only while it is still pending approval;
//  - owner/manager at any time (an approved/rejected request goes back to
//    pending when they save, so it gets approved again).
// Never once a ใบสั่งซื้อ exists: that PO copied the items.
export function canEditPurchaseRequest(
  profile: { id: string; role: string },
  request: Pick<PurchaseRequest, "requestedById" | "status" | "hasPurchaseOrder">,
): boolean {
  if (request.hasPurchaseOrder) return false;
  const isAdmin = profile.role === "owner" || profile.role === "manager";
  if (request.status === "รออนุมัติ") return isAdmin || request.requestedById === profile.id;
  return isAdmin;
}
