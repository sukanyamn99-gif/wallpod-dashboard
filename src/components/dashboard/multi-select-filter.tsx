"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Checkbox-list dropdown instead of a single-value Select — lets the user
// click any number of options on and see the result narrow immediately,
// rather than only ever isolating one value at a time. Shared by the
// WALLPOD Project Sales report table and the Sales Dashboard.
export function MultiSelectFilter({
  allLabel,
  countLabel,
  options,
  selected,
  onChange,
}: {
  allLabel: string;
  countLabel: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const triggerLabel =
    selected.size === 0
      ? allLabel
      : selected.size === 1
        ? (options.find((o) => selected.has(o.value))?.label ?? allLabel)
        : `${countLabel} (${selected.size})`;

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="w-[180px] justify-between font-normal">
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <DropdownMenuContent className="max-h-64 overflow-y-auto">
        {selected.size > 0 && (
          <>
            <DropdownMenuItem onClick={() => onChange(new Set())}>ล้างตัวกรอง</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.has(opt.value)}
            onCheckedChange={() => toggle(opt.value)}
            closeOnClick={false}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
