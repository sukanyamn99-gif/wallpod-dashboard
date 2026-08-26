import type { Role } from "@/lib/types";

const ADMIN_ROLES: Role[] = ["owner", "manager"];
const STOCK_STAFF: Role[] = ["owner", "manager", "support_sale", "account", "foreman", "production"];

// Every page an authenticated role may reach. Owner/manager see everything
// ("ทุกเมนู") except /dashboard/users, which stays owner-only on purpose —
// it grants role changes (including promotion to owner) and shows every
// user's email, a tighter risk tier than ordinary admin access.
//
// A path with no entry here falls through to "allowed" (see canAccessPage) —
// matches this app's existing convention of only gating list/dashboard
// pages, not every detail/sub-route (those rely on RLS + UI button-hiding).
const PAGE_ACCESS: Record<string, Role[]> = {
  "/dashboard/users": ["owner"],
  "/dashboard/sales": ["owner", "manager", "sales", "design", "support_sale", "account", "foreman", "production"],
  "/dashboard/sale-report": ["owner", "manager", "sales"],
  "/dashboard/gp": ADMIN_ROLES,
  "/dashboard/ar": [...ADMIN_ROLES, "account"],
  "/dashboard/project-sales": STOCK_STAFF,
  "/dashboard/inventory": STOCK_STAFF,
  "/dashboard/stock-product": STOCK_STAFF,
  "/dashboard/stock-product/report": [...STOCK_STAFF, "sales", "design"],
  "/dashboard/product-categories": STOCK_STAFF,
  "/dashboard/goods-receipt": STOCK_STAFF,
  "/dashboard/goods-receipt/report": STOCK_STAFF,
  "/dashboard/stock-requisition": STOCK_STAFF,
  "/dashboard/stock-requisition/report": STOCK_STAFF,
  "/dashboard/stock-movement": STOCK_STAFF,
  "/dashboard/inventory/alerts": STOCK_STAFF,
  "/dashboard/inventory/report": STOCK_STAFF,
  "/dashboard/expenses": [...ADMIN_ROLES, "account"],
  "/dashboard/expenses/payment-vouchers": [...ADMIN_ROLES, "account"],
  "/dashboard/expenses/petty-cash": [...ADMIN_ROLES, "account"],
  "/dashboard/settings/documents": [...ADMIN_ROLES, "support_sale", "account"],
  "/dashboard/settings/activity-log": ADMIN_ROLES,
};

export function canAccessPage(role: Role, path: string): boolean {
  return PAGE_ACCESS[path]?.includes(role) ?? true;
}

// Cost/profit figures (unit cost, stock value, GP margins) are admin-only
// UI-level redaction — the underlying columns stay readable at the RLS
// layer, a deliberate simplification over a database-level view.
export function canSeeCosts(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

// "Can add" rights, split per feature since they don't all start from the
// same base rule — Stock Product/Categories were owner/manager-only before
// this change, Goods Receipt/Requisition already included 'production'.
// Both gain support_sale/account for create; editing/deleting existing
// rows stays a separate, narrower check per feature (see each page's own
// canManage-style helper).
export function canCreateStockProduct(role: Role): boolean {
  return role === "owner" || role === "manager" || role === "support_sale" || role === "account";
}

export function canCreateStockMovementDoc(role: Role): boolean {
  return role === "owner" || role === "manager" || role === "production" || role === "support_sale" || role === "account";
}
