"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE_VALUE = "__none__";

// A real dropdown constrained to actual JOB NO. values (unlike the old
// free-text-with-suggestions field) — a typo can no longer silently exclude
// an expense from a job's cost, since only a job that really exists can be
// picked. Base UI's Select supports keyboard typeahead while the list is
// open, which is enough to jump close to a specific job in a long list.
//
// Deliberately doesn't take a `name` prop / render a hidden input itself —
// its internal value uses a NONE_VALUE sentinel (Base UI Select can't use a
// real empty string as an item value), so the caller renders its own
// `<input type="hidden" name="job_no" value={value} />` to submit the true
// empty-or-real-job-no value, same pattern as this app's other client-state
// fields backed by a hidden input (e.g. RequisitionForm's `purpose`).
export function JobNoSelect({
  id,
  value,
  onChange,
  jobNos,
  placeholder = "— ไม่ระบุ Job —",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  jobNos: string[];
  placeholder?: string;
}) {
  // Newest jobs are the ones most likely to be tagged on a fresh expense.
  const sorted = [...jobNos].sort((a, b) => b.localeCompare(a));
  const items = [{ value: NONE_VALUE, label: placeholder }, ...sorted.map((j) => ({ value: j, label: j }))];

  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(v) => onChange(v === NONE_VALUE ? "" : ((v as string) ?? ""))}
      items={items}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value}>
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
