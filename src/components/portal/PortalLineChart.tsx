import * as React from "react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface PortalLineChartProps {
  data: DataPoint[];
  lines: Array<{
    dataKey: string;
    stroke: string;
    name: string;
  }>;
  height?: number;
  className?: string;
}

export const PortalLineChart: React.FC<PortalLineChartProps> = ({
  data,
  lines,
  height = 300,
  className,
}) => {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--portal-border))" opacity={0.3} />
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
            labelStyle={{ color: "hsl(var(--portal-text-secondary))" }}
          />
          <Legend
            wrapperStyle={{ color: "hsl(var(--portal-text-secondary))" }}
            iconType="circle"
          />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeWidth={2}
              name={line.name}
              dot={{ r: 4, fill: line.stroke }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
