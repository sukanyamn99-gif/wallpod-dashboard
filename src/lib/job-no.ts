// Every real JOB NO. in this app follows JB + 2-digit year + 2-digit month +
// 3-digit sequence (e.g. "JB2607001") — confirmed against live data: all 176
// existing jobs match this exact shape, none shorter or longer.
export const JOB_NO_PATTERN = /^JB\d{2}\d{2}\d{3}$/;

export const JOB_NO_HINT = "รูปแบบต้องเป็น JB ตามด้วยตัวเลข 7 หลัก เช่น JB2607001";

// `required` is for the one place (WALLPOD Project Sales' own job_no) where
// this field IS the record's identity; every other usage is an optional
// free-text reference into that table, so an empty value is fine there.
export function getJobNoError(value: string, { required = false }: { required?: boolean } = {}): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? "กรุณากรอกเลขที่ Job" : null;
  if (!JOB_NO_PATTERN.test(trimmed)) return `เลขที่ Job ไม่ถูกต้อง — ${JOB_NO_HINT}`;
  return null;
}
