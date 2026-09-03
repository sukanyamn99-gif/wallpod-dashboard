"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Banknote,
  BookUser,
  Boxes,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  ClipboardMinus,
  FileBarChart,
  FileCheck2,
  FileDown,
  Files,
  FileSignature,
  FileSpreadsheet,
  FileStack,
  FileText,
  FileUp,
  Gauge,
  HandCoins,
  History,
  TriangleAlert,
  LineChart,
  Package,
  PackagePlus,
  Palette,
  Percent,
  Receipt,
  ReceiptText,
  ScrollText,
  Settings,
  Tags,
  Users,
  Wallet,
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
  { title: "Owner Dashboard", url: "/dashboard/owner", icon: Gauge },
  { title: "Sales Dashboard", url: "/dashboard/sales", icon: LineChart },
  { title: "GP Dashboard", url: "/dashboard/gp", icon: BarChart3 },
  { title: "AR Dashboard", url: "/dashboard/ar", icon: Receipt },
  { title: "Ex Dashboard", url: "/dashboard/expenses", icon: BarChart3 },
  { title: "Stock Dashboard", url: "/dashboard/inventory", icon: Boxes },
  { title: "Koonway Project Sales", url: "/dashboard/project-sales", icon: ClipboardList },
];

const salesDocsGroup = {
  title: "เอกสารขาย",
  icon: Files,
  items: [
    { title: "ใบเสนอราคา", url: "/dashboard/quotations", icon: FileSignature },
    { title: "ใบวางบิล", url: "/dashboard/billing-documents/billing-note", icon: FileStack },
    { title: "ใบกำกับภาษี", url: "/dashboard/billing-documents/tax-invoice", icon: FileCheck2 },
    { title: "ใบเสร็จรับเงิน", url: "/dashboard/billing-documents/receipt", icon: ReceiptText },
    { title: "ลูกค้า", url: "/dashboard/customers", icon: BookUser },
  ],
};

const inventoryGroup = {
  title: "Stock Data",
  icon: Warehouse,
  items: [
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
        { title: "รายงานสินค้าคงเหลือ", url: "/dashboard/stock-product/report", icon: Palette },
      ],
    },
  ],
};

const expensesGroup = {
  title: "Expenses",
  icon: Banknote,
  items: [
    { title: "Payment Voucher (ใบสำคัญจ่าย)", url: "/dashboard/expenses/payment-vouchers", icon: FileSpreadsheet },
    { title: "เงินสดย่อย", url: "/dashboard/expenses/petty-cash", icon: Wallet },
    { title: "เจ้าหนี้คงค้าง", url: "/dashboard/expenses/payables", icon: HandCoins },
    { title: "เงินเดือน", url: "/dashboard/expenses/payroll", icon: CircleDollarSign },
    { title: "คำนวณค่าคอมมิชชั่น", url: "/dashboard/expenses/commission", icon: Percent },
  ],
};

const remainingNavItems = [{ title: "Sale Report", url: "/dashboard/sale-report", icon: CalendarCheck }];

const settingsGroup = {
  title: "ตั้งค่า",
  icon: Settings,
  items: [
    { title: "ผู้ใช้งาน", url: "/dashboard/users", icon: Users },
    { title: "เก็บ log การใช้งาน", url: "/dashboard/settings/activity-log", icon: ScrollText },
    { title: "ตั้งค่าเอกสารต่างๆ", url: "/dashboard/settings/documents", icon: FileText },
  ],
};

export function AppSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isSalesDocsActive = salesDocsGroup.items.some((item) => pathname === item.url);
  const [salesDocsOpen, setSalesDocsOpen] = useState(isSalesDocsActive);
  const isInventoryActive = inventoryGroup.items.some(
    (item) => pathname === item.url || item.children?.some((c) => pathname === c.url),
  );
  const [inventoryOpen, setInventoryOpen] = useState(isInventoryActive);
  const isExpensesActive = expensesGroup.items.some((item) => pathname === item.url);
  const [expensesOpen, setExpensesOpen] = useState(isExpensesActive);
  const isSettingsActive = settingsGroup.items.some((item) => pathname === item.url);
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);

  const visibleNavItems = navItems.filter((item) => canAccessPage(profile.role, item.url));
  const visibleSalesDocsItems = salesDocsGroup.items.filter((item) => canAccessPage(profile.role, item.url));
  // A role can be granted a child (e.g. "รายงานสินค้าคงเหลือ") without
  // access to its parent group page (e.g. the aggregate "รายงาน" page,
  // which shows cost data Sales/Designer shouldn't see) — in that case the
  // parent link would just redirect them away, so flatten the accessible
  // children up to this level instead of nesting them under a dead link.
  const visibleInventoryItems = inventoryGroup.items.flatMap((item) => {
    const visibleChildren = item.children?.filter((c) => canAccessPage(profile.role, c.url));
    if (canAccessPage(profile.role, item.url)) return [{ ...item, children: visibleChildren }];
    return (visibleChildren ?? []).map((c) => ({ ...c, children: undefined }));
  });
  const visibleExpensesItems = expensesGroup.items.filter((item) => canAccessPage(profile.role, item.url));
  const visibleRemainingNavItems = remainingNavItems.filter((item) => canAccessPage(profile.role, item.url));
  const visibleSettingsItems = settingsGroup.items.filter((item) => canAccessPage(profile.role, item.url));

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

              {visibleSalesDocsItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isSalesDocsActive}
                    onClick={() => setSalesDocsOpen((open) => !open)}
                  >
                    <salesDocsGroup.icon />
                    <span>{salesDocsGroup.title}</span>
                    {salesDocsOpen ? <ChevronDown className="ml-auto" /> : <ChevronRight className="ml-auto" />}
                  </SidebarMenuButton>
                  {salesDocsOpen && (
                    <SidebarMenuSub>
                      {visibleSalesDocsItems.map((item) => (
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
              )}

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

              {visibleExpensesItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isExpensesActive}
                    onClick={() => setExpensesOpen((open) => !open)}
                  >
                    <expensesGroup.icon />
                    <span>{expensesGroup.title}</span>
                    {expensesOpen ? <ChevronDown className="ml-auto" /> : <ChevronRight className="ml-auto" />}
                  </SidebarMenuButton>
                  {expensesOpen && (
                    <SidebarMenuSub>
                      {visibleExpensesItems.map((item) => (
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

              {visibleSettingsItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isSettingsActive}
                    onClick={() => setSettingsOpen((open) => !open)}
                  >
                    <settingsGroup.icon />
                    <span>{settingsGroup.title}</span>
                    {settingsOpen ? <ChevronDown className="ml-auto" /> : <ChevronRight className="ml-auto" />}
                  </SidebarMenuButton>
                  {settingsOpen && (
                    <SidebarMenuSub>
                      {visibleSettingsItems.map((item) => (
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
              )}
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
