"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

// Standard payment-term labels seen on the real reference quotations —
// offered as suggestions, not a fixed list: any custom text still works,
// this just saves re-typing the common 3-step deposit/install/finish cycle.
const STANDARD_LABELS = [
  "Deporsit / มัดจำก่อนผลิต",
  "Start installation date / ก่อนเข้าติดตั้งสินค้า",
  "Finish installation date (7 Days) / หลังติดตั้งเสร็จ (ภายใน 7 วัน)",
];

export function PaymentTermLabelAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q ? STANDARD_LABELS.filter((s) => s.toLowerCase().includes(q)) : STANDARD_LABELS;
    return pool.slice(0, 8);
  }, [value]);

  return (
    <div className="relative flex-1">
      <Input
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s);
                  setOpen(false);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
