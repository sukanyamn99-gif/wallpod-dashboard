import { ArrowDown, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GpSparkline } from "@/components/dashboard/gp-sparkline";
import { cn } from "@/lib/utils";

// "r g b" triplets, so the same colour can be used at any opacity in CSS.
const ACCENTS = {
  blue: { rgb: "96 165 250", hex: "#60a5fa" },
  amber: { rgb: "245 183 60", hex: "#f5b73c" },
  green: { rgb: "52 211 153", hex: "#34d399" },
  violet: { rgb: "167 139 250", hex: "#a78bfa" },
} as const;

export type GpKpiTone = keyof typeof ACCENTS;

export function GpKpiCard({
  label,
  value,
  icon: Icon,
  tone,
  delta,
  deltaUnit = "%",
  comparedWith,
  // For a figure where going up is bad (cost), a rise is shown in red.
  upIsBad = false,
  spark,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: GpKpiTone;
  // null: nothing to compare with, so no change line is shown.
  delta: number | null;
  deltaUnit?: "%" | "จุด";
  comparedWith: string | null;
  upIsBad?: boolean;
  spark: number[];
}) {
  const accent = ACCENTS[tone];
  const up = (delta ?? 0) >= 0;
  const good = upIsBad ? !up : up;

  return (
    <div className="gp-glass overflow-hidden p-4" style={{ "--gp-accent": accent.rgb } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
          style={{
            background: `rgb(${accent.rgb} / 0.18)`,
            borderColor: `rgb(${accent.rgb} / 0.4)`,
            color: accent.hex,
          }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-300">{label}</p>
          <p className="truncate text-2xl leading-tight font-semibold tabular-nums text-white">{value}</p>
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        {delta !== null && comparedWith ? (
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400">
            <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-emerald-400" : "text-rose-400")}>
              {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {up ? "+" : "−"}
              {Math.abs(delta).toFixed(1)}
              {deltaUnit === "%" ? "%" : " จุด"}
            </span>
            เทียบกับ{comparedWith}
          </p>
        ) : (
          <span />
        )}
        <div className="h-10 w-28 shrink-0">
          <GpSparkline values={spark} color={accent.hex} />
        </div>
      </div>
    </div>
  );
}
