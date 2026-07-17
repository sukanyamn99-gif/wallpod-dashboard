"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/types";

export function CustomerAutocomplete({
  id,
  name,
  value,
  onChange,
  customers,
  placeholder,
  required,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  customers: Customer[];
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value, customers]);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        required={required}
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
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c.name);
                  setOpen(false);
                }}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
