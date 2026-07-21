"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export function SizeAutocomplete({
  id,
  name,
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q ? suggestions.filter((s) => s.toLowerCase().includes(q)) : suggestions;
    return pool.slice(0, 8);
  }, [value, suggestions]);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
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
