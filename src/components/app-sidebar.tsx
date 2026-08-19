"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ClipboardMinus,
  FileBarChart,
  FileDown,
  FileUp,
  History,
  TriangleAlert,
  LineChart,
  Package,
  PackagePlus,
  PackageX,
  Receipt,
  Tags,
  Users,
  Warehouse,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/login/actions";
import { canAccessPage } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

const navItems = [
  { title: "Sales Dashboard", url: "/dashboard/sales", icon: LineChart },
  { title: "WALLPOD Project Sales", url: "/dashboard/project-sales", icon: ClipboardList },
  { title: "GP Dashboard", url: "/dashboard/gp", icon: BarChart3 },
  { title: "AR Dashboard", url: "/dashboard/ar", icon: Receipt },
];

const inventoryGroup = {
  title: "Stock Data",
  icon: Warehouse,
  items: [
    { title: "Stock Dashboard", url: "/dashboard/inventory", icon: Boxes },
    { title: "สินค้า", url: "/dashboard/stock-product", icon: Package },
    { title: "หมวดหมู่สินค้า", url: "/dashboard/product-categories", icon: Tags },
    { title: "รับเข้าสินค้า", url: "/dashboard/goods-receipt", icon: PackagePlus },
    { title: "ใบเบิกสินค้า", url: "/dashboard/stock-requisition", icon: ClipboardMinus },
    { title: "ความเคลื่อนไหวสินค้า", url: "/dashboard/stock-movement", icon: History },
    { title: "แจ้งเตือนสินค้าใกล้หมด", url: "/dashboard/inventory/alerts", icon: TriangleAlert },
    {
      title: "รายงาน",
      url: "/dashboard/inventory/report",
      icon: FileBarChart,
      children: [
        { title: "รายงานการเบิกสินค้า", url: "/dashboard/stock-requisition/report", icon: FileUp },
        { title: "รายงานการรับเข้าสินค้า", url: "/dashboard/goods-receipt/report", icon: FileDown },
      ],
    },
  ],
};

const remainingNavItems = [
  { title: "Dead Stock Dashboard", url: "/dashboard/dead-stock", icon: PackageX },
  { title: "Sale Report", url: "/dashboard/sale-report", icon: CalendarCheck },
];

const ownerOnlyNavItems = [{ title: "ผู้ใช้งาน", url: "/dashboard/users", icon: Users }];

export function AppSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isInventoryActive = inventoryGroup.items.some(
    (item) => pathname === item.url || item.children?.some((c) => pathname === c.url),
  );
  const [inventoryOpen, setInventoryOpen] = useState(isInventoryActive);

  const visibleNavItems = navItems.filter((item) => canAccessPage(profile.role, item.url));
  const visibleInventoryItems = inventoryGroup.items
    .filter((item) => canAccessPage(profile.role, item.url))
    .map((item) => ({
      ...item,
      children: item.children?.filter((c) => canAccessPage(profile.role, c.url)),
    }));
  const visibleRemainingNavItems = remainingNavItems.filter((item) => canAccessPage(profile.role, item.url));

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <p className="text-sm font-semibold">Koonway Co.,Ltd.</p>
        <p className="text-xs text-muted-foreground">คูนเว จำกัด</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>เมนู</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname === item.url}
                    render={
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}

              {visibleInventoryItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isInventoryActive}
                    onClick={() => setInventoryOpen((open) => !open)}
                  >
                    <inventoryGroup.icon />
                    <span>{inventoryGroup.title}</span>
                    {inventoryOpen ? <ChevronDown className="ml-auto" /> : <ChevronRight className="ml-auto" />}
                  </SidebarMenuButton>
                  {inventoryOpen && (
                    <SidebarMenuSub>
                      {visibleInventoryItems.map((item) => (
                        <SidebarMenuSubItem key={item.url}>
                          <SidebarMenuSubButton
                            isActive={pathname === item.url}
                            render={
                              <Link href={item.url}>
                                <item.icon />
                                <span>{item.title}</span>
                              </Link>
                            }
                          />
                          {item.children && item.children.length > 0 && (
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.url}>
                                  <SidebarMenuSubButton
                                    size="sm"
                                    isActive={pathname === child.url}
                                    render={
                                      <Link href={child.url}>
                                        <child.icon />
                                        <span>{child.title}</span>
                                      </Link>
                                    }
                                  />
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          )}
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )}

              {visibleRemainingNavItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname === item.url}
                    render={
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}

              {profile.role === "owner" &&
                ownerOnlyNavItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={pathname === item.url}
                      render={
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 px-4 py-3">
        <p className="text-sm font-medium">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground">{profile.role}</p>
        {profile.id !== "demo" && (
          <form action={signOut}>
            <SidebarMenuButton type="submit" className="w-full">
              <LogOut />
              <span>ออกจากระบบ</span>
            </SidebarMenuButton>
          </form>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
