import { Card, CardContent } from "@/components/ui/card";
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
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
  onClick?: () => void;
  colorValue?: boolean;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(onClick && "cursor-pointer transition-colors hover:bg-accent/40")}
    >
      <CardContent className="flex items-center gap-3">
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
          <div className={cn("truncate text-2xl leading-tight font-semibold tabular-nums", colorValue ? VALUE_TONE_CLASSES[tone] : "text-foreground")}>
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
