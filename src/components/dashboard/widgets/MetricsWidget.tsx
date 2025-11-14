import { DashboardWidget } from "../DashboardWidget";
import { TrendingUp, TrendingDown } from "lucide-react";
import StatCounter from "@/components/StatCounter";

interface MetricsWidgetProps {
  title: string;
  value: number;
  change?: number;
  suffix?: string;
  prefix?: string;
  icon?: React.ReactNode;
}

export function MetricsWidget({ title, value, change, suffix, prefix, icon }: MetricsWidgetProps) {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <DashboardWidget title={title} icon={icon}>
      <div className="flex flex-col justify-center h-full">
        <div className="text-4xl font-bold text-foreground">
          <StatCounter end={value} prefix={prefix} suffix={suffix} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-2 mt-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="font-medium">
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        )}
      </div>
    </DashboardWidget>
  );
}
