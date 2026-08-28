import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TONE_CLASSES = {
  blue: "bg-[color-mix(in_oklch,var(--chart-1),transparent_86%)] text-[var(--chart-1)]",
  green: "bg-[color-mix(in_oklch,var(--chart-2),transparent_86%)] text-[var(--chart-2)]",
  amber: "bg-[color-mix(in_oklch,var(--chart-3),transparent_86%)] text-[var(--chart-3)]",
  violet: "bg-[color-mix(in_oklch,var(--chart-5),transparent_86%)] text-[var(--chart-5)]",
  rose: "bg-[color-mix(in_oklch,var(--destructive),transparent_86%)] text-[var(--destructive)]",
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", TONE_CLASSES[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", colorValue && VALUE_TONE_CLASSES[tone])}>{value}</div>
      </CardContent>
    </Card>
  );
}
