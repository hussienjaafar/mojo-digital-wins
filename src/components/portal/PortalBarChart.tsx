import * as React from "react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DataPoint {
  name: string;
  value: number;
  label?: string;
}

interface PortalBarChartProps {
  data: DataPoint[];
  height?: number;
  barColor?: string;
  className?: string;
}

export const PortalBarChart: React.FC<PortalBarChartProps> = ({
  data,
  height = 250,
  barColor = "hsl(var(--portal-accent-blue))",
  className,
}) => {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--portal-border))" opacity={0.2} />
          <XAxis
            dataKey="name"
            stroke="hsl(var(--portal-text-muted))"
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: 12 }}
            axisLine={{ stroke: "hsl(var(--portal-border))" }}
          />
          <YAxis
            stroke="hsl(var(--portal-text-muted))"
            tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: 12 }}
            axisLine={{ stroke: "hsl(var(--portal-border))" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--portal-bg-tertiary))",
              border: "1px solid hsl(var(--portal-border))",
              borderRadius: "8px",
              color: "hsl(var(--portal-text-primary))",
            }}
            cursor={{ fill: "hsl(var(--portal-bg-elevated) / 0.3)" }}
          />
          <Bar dataKey="value" fill={barColor} radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={barColor}
                style={{
                  filter: "drop-shadow(0 0 6px hsl(var(--portal-accent-blue) / 0.4))",
                }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
