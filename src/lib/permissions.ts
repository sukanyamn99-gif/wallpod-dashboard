import type { Role } from "@/lib/types";

export type PermissionTier = "admin" | "staff" | "sale";

export function getTier(role: Role): PermissionTier {
  if (role === "owner" || role === "manager") return "admin";
  if (role === "sales") return "sale";
  return "staff";
}

const PAGE_ACCESS: Record<string, PermissionTier[]> = {
  "/dashboard/sales": ["admin", "staff", "sale"],
  "/dashboard/inventory": ["admin", "staff", "sale"],
  "/dashboard/stock-product": ["admin", "staff", "sale"],
  "/dashboard/project-sales": ["admin", "staff"],
  "/dashboard/product-categories": ["admin", "staff"],
  "/dashboard/stock-requisition": ["admin", "staff"],
  "/dashboard/stock-movement": ["admin", "staff"],
  "/dashboard/sale-report": ["admin", "sale"],
  "/dashboard/gp": ["admin"],
  "/dashboard/ar": ["admin"],
  "/dashboard/dead-stock": ["admin"],
};

export function canAccessPage(role: Role, path: string): boolean {
  return PAGE_ACCESS[path]?.includes(getTier(role)) ?? true;
}

export function canSeeCosts(role: Role): boolean {
  return getTier(role) === "admin";
}
