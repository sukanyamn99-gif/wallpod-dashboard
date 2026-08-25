// Converts a number to Thai baht text for printed documents, e.g.
// 15300 -> "หนึ่งหมื่นห้าพันสามร้อยบาทถ้วน" — the standard Thai
// accounting-document number-to-words algorithm (place-value words with
// the "เอ็ด"/"ยี่" irregulars), not a library, since this is a small,
// fully-deterministic conversion with no real edge cases to depend on.
const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function convertGroup(numStr: string): string {
  let result = "";
  const len = numStr.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(numStr[i]);
    const place = len - i - 1;
    if (digit === 0) continue;

    if (place === 0 && digit === 1 && len > 1) {
      result += "เอ็ด";
    } else if (place === 1 && digit === 2) {
      result += "ยี่" + PLACES[place];
    } else if (place === 1 && digit === 1) {
      result += PLACES[place];
    } else {
      result += DIGITS[digit] + PLACES[place];
    }
  }
  return result;
}

function convertInteger(n: number): string {
  if (n === 0) return "ศูนย์";
  let numStr = String(Math.floor(n));
  let result = "";
  // Split into groups of 6 digits (ล้าน repeats for numbers >= 1,000,000,000,000)
  while (numStr.length > 6) {
    const head = numStr.slice(0, numStr.length - 6);
    result = convertGroup(head) + "ล้าน" + result;
    numStr = numStr.slice(numStr.length - 6);
  }
  result += convertGroup(numStr);
  return result;
}

export function thaiBahtText(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);

  const bahtText = convertInteger(baht) + "บาท";
  if (satang === 0) return bahtText + "ถ้วน";
  return bahtText + convertInteger(satang) + "สตางค์";
}
