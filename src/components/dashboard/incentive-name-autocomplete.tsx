"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";

// Suggested only — not a fixed roster tied to any role in the system (see
// month-selector.tsx's own comment on why this is free text, not a role
// query). Saves retyping the same few names most months while still
// allowing anyone else to be typed in directly.
const SUGGESTED_NAMES = ["สุขกันยา มุ่งงาม", "ณภัสชนก อ่องละออ", "พรชิตา ผลาผล", "คงเดช วรรณพิรุฬ"];

export function IncentiveNameAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q ? SUGGESTED_NAMES.filter((s) => s.toLowerCase().includes(q)) : SUGGESTED_NAMES;
    return pool.slice(0, 8);
  }, [value]);

  // Rendered into a portal (see below) specifically so this list isn't
  // clipped by an ancestor Card's overflow-hidden (used everywhere for its
  // own rounded corners) — position tracked in fixed/viewport coordinates
  // instead of relying on being a normal-flow descendant.
  useEffect(() => {
    if (!open) return;
    function updateRect() {
      const el = wrapperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuRect({ top: r.bottom, left: r.left, width: r.width });
    }
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative flex-1">
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
      {open &&
        matches.length > 0 &&
        menuRect &&
        createPortal(
          <ul
            style={{ position: "fixed", top: menuRect.top + 4, left: menuRect.left, width: menuRect.width }}
            className="z-50 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
          >
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
          </ul>,
          document.body,
        )}
    </div>
  );
}
