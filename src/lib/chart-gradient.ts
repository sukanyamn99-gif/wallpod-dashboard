// Gradient fills for the charts. The gradients themselves are defined once for
// the whole page (components/dashboard/chart-gradient-defs.tsx, rendered by the
// dashboard layout) for every colour listed here; a chart then just points its
// fill at one with chartGradient(). A colour that is not listed is returned as
// it is, so an unknown colour still draws, flat.
//
// "h"  left -> right, for horizontal bars (dark at the label, light at the tip)
// "v"  top -> bottom, for columns (light at the top, the colour at the foot)
// "d"  diagonal, for the slices of a ring
export type GradientKind = "h" | "v" | "d";

export const GRADIENT_TOKENS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-seq-1",
  "chart-seq-2",
  "chart-seq-3",
  "chart-seq-4",
  "status-critical",
];

// Flat colours used directly by the ring charts.
export const GRADIENT_HEX_COLORS = ["#3b82f6", "#10b981", "#f5b73c", "#a78bfa", "#f97316", "#6366f1", "#14b8a6", "#ec4899"];

export const GRADIENT_KINDS: GradientKind[] = ["h", "v", "d"];

export function gradientId(kind: GradientKind, name: string): string {
  return `cg-${kind}-${name}`;
}

export function chartGradient(color: string, kind: GradientKind): string {
  const token = /^var\(--([\w-]+)\)$/.exec(color)?.[1];
  if (token && GRADIENT_TOKENS.includes(token)) return `url(#${gradientId(kind, token)})`;
  if (GRADIENT_HEX_COLORS.includes(color.toLowerCase())) return `url(#${gradientId(kind, color.slice(1).toLowerCase())})`;
  return color;
}
