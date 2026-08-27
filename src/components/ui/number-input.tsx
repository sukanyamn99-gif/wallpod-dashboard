"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// A plain <input type="number"> shows raw digits only ("1234.5", no comma
// thousands separator) — there's no native way to format one while still
// letting the browser treat it as a number. This shows the formatted
// version ("1,234.50") whenever the field isn't focused, and the raw
// editable digits while it is, so typing/backspacing never fights comma
// insertion. The actual submitted value (under `name`) is always the plain
// numeric string — formatting is display-only, never sent to the server.

export interface NumberInputProps {
  id?: string;
  name?: string;
  defaultValue?: string | number | null;
  value?: string | number | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  min?: number;
  step?: number;
}

function cleanRaw(input: string): string {
  let s = input.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  return s;
}

function formatDisplay(raw: string): string {
  if (raw === "" || raw === ".") return raw;
  const [intPart, decPart] = raw.split(".");
  const formattedInt = (Number(intPart || "0") || 0).toLocaleString("en-US");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

export function NumberInput({
  id,
  name,
  defaultValue,
  value,
  onChange,
  placeholder,
  required,
  readOnly,
  disabled,
  className,
  min,
  step,
}: NumberInputProps) {
  const isControlled = value !== undefined;
  const [internalRaw, setInternalRaw] = useState(() =>
    defaultValue === null || defaultValue === undefined ? "" : String(defaultValue),
  );
  const raw = isControlled ? (value === null || value === undefined ? "" : String(value)) : internalRaw;
  const [focused, setFocused] = useState(false);

  function setRaw(next: string) {
    if (!isControlled) setInternalRaw(next);
    onChange?.(next);
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-required={required}
        min={min}
        step={step}
        value={focused ? raw : formatDisplay(raw)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => setRaw(cleanRaw(e.target.value))}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        data-slot="number-input"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-right text-base tabular-nums transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
          readOnly && "bg-muted",
          className,
        )}
      />
      {name && <input type="hidden" name={name} value={raw} />}
    </div>
  );
}
