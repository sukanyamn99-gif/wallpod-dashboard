export function formatTHB(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);
}

// Matches the reference quotation form's labeled multi-line layout — only
// lines with a real value are shown, so an item without e.g. a color on
// file doesn't print a dangling "Color/สี :" line.
export function formatQuotationItemDescription(item: {
  productName: string;
  thickness: string | null;
  size: string | null;
  color: string | null;
}): string {
  const lines: string[] = [];
  if (item.productName) lines.push(`Product Name : ${item.productName}`);
  if (item.thickness) lines.push(`Thickness /หนา : ${item.thickness}`);
  if (item.size) lines.push(`Size /ขนาด : ${item.size}`);
  if (item.color) lines.push(`Color/สี : ${item.color}`);
  return lines.join("\n");
}
