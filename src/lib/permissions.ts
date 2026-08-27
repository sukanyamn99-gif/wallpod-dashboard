import type { Role } from "@/lib/types";

const ADMIN_ROLES: Role[] = ["owner", "manager"];
const STOCK_STAFF: Role[] = ["owner", "manager", "support_sale", "account", "foreman", "production"];

// Every page an authenticated role may reach. Owner/manager see everything
// ("ทุกเมนู") including /dashboard/users — user management (edit, password
// reset, delete) is admin-tier, not owner-exclusive; only creating a brand
// new account stays owner-only (see createUserAccount in actions.ts).
//
// A path with no entry here falls through to "allowed" (see canAccessPage) —
// matches this app's existing convention of only gating list/dashboard
// pages, not every detail/sub-route (those rely on RLS + UI button-hiding).
const PAGE_ACCESS: Record<string, Role[]> = {
  "/dashboard/users": ADMIN_ROLES,
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

// Sales Dashboard KPI cards/charts show aggregate figures to every role
// (including "sales", since Sale reps compare their own numbers against
// the team) — but clicking through to the underlying per-job drill-down
// list (with links into WALLPOD Project Sales) should stay off-limits for
// "sales" specifically, matching the fact that they can't reach that
// feature's own page.
export function canDrillDownSalesDashboard(role: Role): boolean {
  return role !== "sales";
}
