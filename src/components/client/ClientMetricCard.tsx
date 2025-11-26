import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface ClientMetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: number;
  trend?: "up" | "down" | "neutral";
  prefix?: string;
  suffix?: string;
  className?: string;
  iconClassName?: string;
}

export function ClientMetricCard({
  title,
  value,
  icon: Icon,
  change,
  trend,
  prefix,
  suffix,
  className,
  iconClassName,
}: ClientMetricCardProps) {
  const getTrendColor = () => {
    if (trend === "up") return "text-success";
    if (trend === "down") return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <Card className={cn("hover:shadow-md transition-all duration-300", className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-foreground">
                {prefix}
                {value}
                {suffix}
              </p>
              {change !== undefined && (
                <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor())}>
                  {trend === "up" && <ArrowUpRight className="h-4 w-4" />}
                  {trend === "down" && <ArrowDownRight className="h-4 w-4" />}
                  <span>{Math.abs(change)}%</span>
                </div>
              )}
            </div>
          </div>
          <div className={cn("p-3 bg-muted/50 rounded-xl", iconClassName)}>
            <Icon className="h-8 w-8 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
