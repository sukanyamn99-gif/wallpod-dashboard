import { Card, CardContent } from "@/components/ui/card";
import { GpSparkline } from "@/components/dashboard/gp-sparkline";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Tinted square with a thin border in the same colour, like the GP Dashboard cards.
const TONE_CLASSES = {
  blue: "border-[color-mix(in_oklch,var(--chart-1),transparent_55%)] bg-[color-mix(in_oklch,var(--chart-1),transparent_82%)] text-[var(--chart-1)]",
  green: "border-[color-mix(in_oklch,var(--chart-2),transparent_55%)] bg-[color-mix(in_oklch,var(--chart-2),transparent_82%)] text-[var(--chart-2)]",
  amber: "border-[color-mix(in_oklch,var(--chart-3),transparent_55%)] bg-[color-mix(in_oklch,var(--chart-3),transparent_82%)] text-[var(--chart-3)]",
  violet: "border-[color-mix(in_oklch,var(--chart-5),transparent_55%)] bg-[color-mix(in_oklch,var(--chart-5),transparent_82%)] text-[var(--chart-5)]",
  rose: "border-[color-mix(in_oklch,var(--destructive),transparent_55%)] bg-[color-mix(in_oklch,var(--destructive),transparent_82%)] text-[var(--destructive)]",
} as const;

// Line colour of the little trend curve, per tone.
const SPARK_COLORS = {
  blue: "#60a5fa",
  green: "#34d399",
  amber: "#f5b73c",
  violet: "#a78bfa",
  rose: "#fb7185",
} as const;

const VALUE_TONE_CLASSES = {
  blue: "text-[var(--chart-1)]",
  green: "text-[var(--chart-2)]",
  amber: "text-[var(--chart-3)]",
  violet: "text-[var(--chart-5)]",
  rose: "text-[var(--destructive)]",
} as const;

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  onClick,
  colorValue = false,
  spark,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
  onClick?: () => void;
  colorValue?: boolean;
  // A point per period for a little trend curve under the figure; left out when there is no history.
  spark?: number[];
  // Extra classes for the card itself (e.g. how many grid columns it spans) and for its figure (e.g. a smaller size).
  className?: string;
  valueClassName?: string;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(onClick && "cursor-pointer transition-colors hover:bg-accent/40", className)}
    >
      <CardContent className="space-y-1">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
              TONE_CLASSES[tone],
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <div
              className={cn(
                "text-2xl leading-tight font-semibold tabular-nums break-words",
                colorValue ? VALUE_TONE_CLASSES[tone] : "text-foreground",
                valueClassName,
              )}
            >
              {value}
            </div>
          </div>
        </div>
        {spark && spark.length >= 2 && (
          <div className="ml-auto h-10 w-28">
            <GpSparkline values={spark} color={SPARK_COLORS[tone]} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
