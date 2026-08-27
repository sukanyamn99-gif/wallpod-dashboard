"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

// Native <input type="date"> displays its value in whatever format the
// browser/OS locale dictates (confirmed: the `lang` attribute has no effect
// in Chromium or Firefox) — there is no way to force a dd/mm/yyyy look with
// the native control. This component replaces the display with three plain
// text segments (always day/month/year, regardless of the visitor's
// browser), while still submitting a normal ISO yyyy-mm-dd value under
// `name` — so every existing server action that reads formData.get(name)
// keeps working unchanged. A calendar-icon button still offers the native
// picker (via showPicker()) as a convenience; picking a date there fills
// the same three segments.

export interface DateInputProps {
  id?: string;
  name?: string;
  defaultValue?: string | null;
  value?: string | null;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

type Segments = { d: string; m: string; y: string };

function parseIso(iso: string | undefined | null): Segments {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!match) return { d: "", m: "", y: "" };
  const [, y, m, d] = match;
  return { d, m, y };
}

function toIso({ d, m, y }: Segments): string {
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return "";
  const dn = Number(d);
  const mn = Number(m);
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return "";
  return `${y}-${m}-${d}`;
}

function onlyDigits(s: string, maxLen: number) {
  return s.replace(/\D/g, "").slice(0, maxLen);
}

export function DateInput({
  id,
  name,
  defaultValue,
  value,
  onChange,
  required,
  disabled,
  className,
}: DateInputProps) {
  // Controlled mode derives segments straight from `value` every render (no
  // effect needed to "resync" — there's nothing to resync, it's just read
  // fresh each time); `internal` only matters in uncontrolled mode.
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<Segments>(() => parseIso(defaultValue));
  const segments = isControlled ? parseIso(value) : internal;

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  function update(next: Partial<Segments>) {
    const merged = { ...segments, ...next };
    if (!isControlled) setInternal(merged);
    onChange?.(toIso(merged));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const digits = text.replace(/\D/g, "");
    if (digits.length < 6) return; // let the default single-field paste happen
    e.preventDefault();
    update({ d: digits.slice(0, 2), m: digits.slice(2, 4), y: digits.slice(4, 8) });
    yearRef.current?.focus();
  }

  function handleDayKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowRight" && dayRef.current?.selectionStart === segments.d.length) monthRef.current?.focus();
  }
  function handleMonthKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && segments.m === "" && monthRef.current?.selectionStart === 0) dayRef.current?.focus();
    if (e.key === "ArrowLeft" && monthRef.current?.selectionStart === 0) dayRef.current?.focus();
    if (e.key === "ArrowRight" && monthRef.current?.selectionStart === segments.m.length) yearRef.current?.focus();
  }
  function handleYearKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && segments.y === "" && yearRef.current?.selectionStart === 0) monthRef.current?.focus();
    if (e.key === "ArrowLeft" && yearRef.current?.selectionStart === 0) monthRef.current?.focus();
  }

  const isoValue = toIso(segments);

  return (
    <div
      className={cn(
        "flex h-8 w-full items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30",
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        className,
      )}
      data-slot="date-input"
    >
      <input
        ref={dayRef}
        id={id}
        aria-label="วัน"
        aria-required={required}
        value={segments.d}
        onChange={(e) => {
          const v = onlyDigits(e.target.value, 2);
          update({ d: v });
          if (v.length === 2) monthRef.current?.focus();
        }}
        onKeyDown={handleDayKeyDown}
        onPaste={handlePaste}
        placeholder="วว"
        inputMode="numeric"
        maxLength={2}
        disabled={disabled}
        className="w-5 min-w-0 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <span className="text-muted-foreground">/</span>
      <input
        ref={monthRef}
        aria-label="เดือน"
        value={segments.m}
        onChange={(e) => {
          const v = onlyDigits(e.target.value, 2);
          update({ m: v });
          if (v.length === 2) yearRef.current?.focus();
        }}
        onKeyDown={handleMonthKeyDown}
        placeholder="ดด"
        inputMode="numeric"
        maxLength={2}
        disabled={disabled}
        className="w-5 min-w-0 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <span className="text-muted-foreground">/</span>
      <input
        ref={yearRef}
        aria-label="ปี"
        value={segments.y}
        onChange={(e) => update({ y: onlyDigits(e.target.value, 4) })}
        onKeyDown={handleYearKeyDown}
        placeholder="ปปปป"
        inputMode="numeric"
        maxLength={4}
        disabled={disabled}
        className="w-10 min-w-0 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"
      />

      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => pickerRef.current?.showPicker?.()}
        className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="เปิดปฏิทิน"
      >
        <CalendarDays className="h-3.5 w-3.5" />
      </button>
      {/* Native picker as a convenience only — visually hidden but still
          reachable via showPicker(); picking a date here fills the segments. */}
      <input
        ref={pickerRef}
        type="date"
        value={isoValue}
        onChange={(e) => update(parseIso(e.target.value))}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      {name && <input type="hidden" name={name} value={isoValue} />}
    </div>
  );
}
