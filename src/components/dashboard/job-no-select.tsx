"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

// A searchable, but still constrained, JOB NO. picker — type to filter a
// long list instead of scrolling a dropdown, while still only ever
// committing a real JOB NO. (never arbitrary free text): a typo can't
// silently point at a job that doesn't exist. Same external contract as
// the plain-dropdown version this replaced (id/value/onChange/jobNos), so
// every existing caller (each rendering its own hidden `job_no` input)
// keeps working unchanged.
export function JobNoSelect({
  id,
  value,
  onChange,
  jobNos,
  placeholder = "พิมพ์เพื่อค้นหาเลขที่ Job...",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  jobNos: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  // Keep the displayed text in sync when the value changes from outside
  // (e.g. cleared after picking a customer directly instead of by JOB) —
  // adjusting state during render (React's documented pattern for this),
  // not in an effect, so it doesn't cause an extra cascading render.
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setQuery(value);
  }

  // Newest jobs are the ones most likely to be tagged on a fresh entry.
  const sorted = useMemo(() => [...jobNos].sort((a, b) => b.localeCompare(a)), [jobNos]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? sorted.filter((j) => j.toLowerCase().includes(q)) : sorted;
    return pool.slice(0, 8);
  }, [query, sorted]);

  function commit(next: string) {
    setQuery(next);
    onChange(next);
    setOpen(false);
  }

  function handleBlur() {
    setOpen(false);
    const trimmed = query.trim();
    if (trimmed === value) return;
    const exact = jobNos.find((j) => j.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
      commit(exact);
    } else if (trimmed === "") {
      commit("");
    } else {
      // Typed text matches no real JOB NO. — revert rather than commit it.
      setQuery(value);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((j) => (
            <li key={j}>
              <button
                type="button"
                className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(j);
                }}
              >
                {j}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
