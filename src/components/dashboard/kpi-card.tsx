import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TONE_CLASSES = {
  blue: "bg-[color-mix(in_oklch,var(--chart-1),transparent_86%)] text-[var(--chart-1)]",
  green: "bg-[color-mix(in_oklch,var(--chart-2),transparent_86%)] text-[var(--chart-2)]",
  amber: "bg-[color-mix(in_oklch,var(--chart-3),transparent_86%)] text-[var(--chart-3)]",
  violet: "bg-[color-mix(in_oklch,var(--chart-5),transparent_86%)] text-[var(--chart-5)]",
} as const;

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", TONE_CLASSES[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
