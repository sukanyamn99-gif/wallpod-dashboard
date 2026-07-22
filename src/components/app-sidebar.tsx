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
  History,
  LineChart,
  Package,
  PackageX,
  Receipt,
  Tags,
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
import type { Profile } from "@/lib/types";

const navItems = [
  { title: "Sales Dashboard", url: "/dashboard/sales", icon: LineChart },
  { title: "WALLPOD Project Sales", url: "/dashboard/project-sales", icon: ClipboardList },
  { title: "GP Dashboard", url: "/dashboard/gp", icon: BarChart3 },
  { title: "AR Dashboard", url: "/dashboard/ar", icon: Receipt },
];

const inventoryGroup = {
  title: "Inventory",
  icon: Warehouse,
  items: [
    { title: "Stock Dashboard", url: "/dashboard/inventory", icon: Boxes },
    { title: "Stock Product", url: "/dashboard/stock-product", icon: Package },
    { title: "หมวดหมู่สินค้า", url: "/dashboard/product-categories", icon: Tags },
    { title: "ใบเบิกสินค้า", url: "/dashboard/stock-requisition", icon: ClipboardMinus },
    { title: "ความเคลื่อนไหวสินค้า", url: "/dashboard/stock-movement", icon: History },
  ],
};

const remainingNavItems = [
  { title: "Dead Stock Dashboard", url: "/dashboard/dead-stock", icon: PackageX },
  { title: "Sale Report", url: "/dashboard/sale-report", icon: CalendarCheck },
];

export function AppSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isInventoryActive = inventoryGroup.items.some((item) => pathname === item.url);
  const [inventoryOpen, setInventoryOpen] = useState(isInventoryActive);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <p className="text-sm font-semibold">WALLPOD Owner Dashboard</p>
        <p className="text-xs text-muted-foreground">คูนเว จำกัด</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>เมนู</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
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
                    {inventoryGroup.items.map((item) => (
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
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>

              {remainingNavItems.map((item) => (
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
