import XLSX from "xlsx";

const FILE_PATH = process.argv[2];
if (!FILE_PATH) throw new Error("Usage: node scripts/qa-inspect-user-file.mjs <path>");

const wb = XLSX.readFile(FILE_PATH, { cellDates: true });
console.log("Sheet names:", wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  console.log(`\n--- Sheet "${sheetName}" (${rows.length} rows) ---`);
  console.log("Row 1 (possible header):", JSON.stringify(rows[0]));
  if (rows[1]) console.log("Row 2:", JSON.stringify(rows[1]));
  if (rows[6]) console.log("Row 7:", JSON.stringify(rows[6]));
}
