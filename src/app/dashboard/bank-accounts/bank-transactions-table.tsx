"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { FilterX } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { normalizeBankName } from "@/lib/bank-name";
import type { BankAccount, BankTransaction } from "@/lib/types";

const TOTAL_COLUMNS = 5;

function inRange(dateStr: string, from: string, to: string) {
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function BankTransactionsTable({
  accounts,
  transactions,
}: {
  accounts: BankAccount[];
  transactions: BankTransaction[];
}) {
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "all");
  const [type, setType] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedKey = selectedAccount ? normalizeBankName(selectedAccount.bankName) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (selectedKey && normalizeBankName(t.bankName) !== selectedKey) return false;
      if (type !== "all" && t.type !== type) return false;
      if (!inRange(t.date, dateFrom, dateTo)) return false;
      if (!q) return true;
      return t.docNo.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [transactions, selectedKey, type, query, dateFrom, dateTo]);

  const inTotal = filtered.filter((t) => t.type === "in").reduce((sum, t) => sum + t.amount, 0);
  const outTotal = filtered.filter((t) => t.type === "out").reduce((sum, t) => sum + t.amount, 0);

  function clearFilters() {
    setType("all");
    setQuery("");
    setDateFrom("");
    setDateTo("");
  }

  const accountItems = [
    { value: "all", label: "ทุกบัญชี" },
    ...accounts.map((a) => ({ value: a.id, label: `${a.bankName} ${a.accountNo}` })),
  ];
  const typeItems = [
    { value: "all", label: "ทุกประเภท" },
    { value: "in", label: "เงินเข้า" },
    { value: "out", label: "เงินออก" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">รายการเงินเข้า-ออก</h2>
        <p className="text-sm text-muted-foreground">
          รายการโอนเงินที่บันทึกไว้ในใบเสร็จรับเงินและใบสำคัญจ่าย ตรงกับชื่อธนาคารที่เลือก
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">เงินเข้ารวม</p>
          <p className="text-2xl font-semibold">{formatTHB(inTotal)}</p>
          <p className="text-xs text-muted-foreground">{filtered.filter((t) => t.type === "in").length} รายการ</p>
        </div>
        <div className="rounded-xl border bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">เงินออกรวม</p>
          <p className="text-2xl font-semibold">{formatTHB(outTotal)}</p>
          <p className="text-xs text-muted-foreground">{filtered.filter((t) => t.type === "out").length} รายการ</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={accountId} onValueChange={(v) => setAccountId((v as string) ?? "all")} items={accountItems}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accountItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType((v as string) ?? "all")} items={typeItems}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขที่เอกสารหรือรายการ..."
          className="max-w-xs"
        />
        <DateInput value={dateFrom} onChange={setDateFrom} className="w-[150px]" />
        <span className="text-sm text-muted-foreground">ถึง</span>
        <DateInput value={dateTo} onChange={setDateTo} className="w-[150px]" />
        <Button variant="outline" onClick={clearFilters}>
          <FilterX className="h-4 w-4" />
          เคลียร์ตัวกรอง
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ประเภท</TableHead>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">รายการ</TableHead>
              <TableHead className="text-right whitespace-nowrap">จำนวนเงิน</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={TOTAL_COLUMNS} className="text-center text-muted-foreground">
                  ไม่พบรายการ
                </TableCell>
              </TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={`${t.type}-${t.id}`}>
                <TableCell className="whitespace-nowrap">{new Date(t.date).toLocaleDateString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={t.type === "in" ? "secondary" : "destructive"}>
                    {t.type === "in" ? "เงินเข้า" : "เงินออก"}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{t.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{t.description}</TableCell>
                <TableCell
                  className={`text-right font-medium whitespace-nowrap ${t.type === "in" ? "text-green-700 dark:text-green-400" : "text-destructive"}`}
                >
                  {t.type === "in" ? "+" : "-"}
                  {formatTHB(t.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
