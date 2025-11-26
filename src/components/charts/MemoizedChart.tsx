import { memo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from 'recharts';
import { deepEqual } from '@/lib/performance';

// Memoized chart components to prevent unnecessary re-renders

export const MemoizedLineChart = memo(
  ({
    data,
    lines,
    xKey,
    height = 300,
    showGrid = true,
    showLegend = true,
  }: {
    data: any[];
    lines: Array<{ key: string; stroke: string; name: string; strokeWidth?: number }>;
    xKey: string;
    height?: number;
    showGrid?: boolean;
    showLegend?: boolean;
  }) => {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            {showLegend && <Legend />}
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.stroke}
                strokeWidth={line.strokeWidth || 2}
                name={line.name}
                dot={{ fill: line.stroke, r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  },
  (prev, next) => deepEqual(prev, next)
);

MemoizedLineChart.displayName = 'MemoizedLineChart';

export const MemoizedBarChart = memo(
  ({
    data,
    bars,
    xKey,
    height = 300,
    showGrid = true,
    showLegend = true,
  }: {
    data: any[];
    bars: Array<{ key: string; fill: string; name: string }>;
    xKey: string;
    height?: number;
    showGrid?: boolean;
    showLegend?: boolean;
  }) => {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            {showLegend && <Legend />}
            {bars.map((bar) => (
              <Bar key={bar.key} dataKey={bar.key} fill={bar.fill} name={bar.name} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  },
  (prev, next) => deepEqual(prev, next)
);

MemoizedBarChart.displayName = 'MemoizedBarChart';

export const MemoizedAreaChart = memo(
  ({
    data,
    areas,
    xKey,
    height = 300,
    showGrid = true,
    showLegend = true,
  }: {
    data: any[];
    areas: Array<{ key: string; fill: string; stroke: string; name: string }>;
    xKey: string;
    height?: number;
    showGrid?: boolean;
    showLegend?: boolean;
  }) => {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            {showLegend && <Legend />}
            {areas.map((area) => (
              <Area
                key={area.key}
                type="monotone"
                dataKey={area.key}
                fill={area.fill}
                stroke={area.stroke}
                name={area.name}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  },
  (prev, next) => deepEqual(prev, next)
);

MemoizedAreaChart.displayName = 'MemoizedAreaChart';

export const MemoizedComposedChart = memo(
  ({
    data,
    components,
    xKey,
    height = 300,
    showGrid = true,
    showLegend = true,
  }: {
    data: any[];
    components: Array<{
      type: 'bar' | 'line' | 'area';
      key: string;
      color: string;
      name: string;
      strokeWidth?: number;
    }>;
    xKey: string;
    height?: number;
    showGrid?: boolean;
    showLegend?: boolean;
  }) => {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            {showLegend && <Legend />}
            {components.map((component) => {
              if (component.type === 'bar') {
                return (
                  <Bar
                    key={component.key}
                    dataKey={component.key}
                    fill={component.color}
                    name={component.name}
                  />
                );
              }
              if (component.type === 'line') {
                return (
                  <Line
                    key={component.key}
                    type="monotone"
                    dataKey={component.key}
                    stroke={component.color}
                    strokeWidth={component.strokeWidth || 3}
                    name={component.name}
                    dot={{ fill: component.color, r: 4 }}
                  />
                );
              }
              if (component.type === 'area') {
                return (
                  <Area
                    key={component.key}
                    type="monotone"
                    dataKey={component.key}
                    fill={component.color}
                    stroke={component.color}
                    name={component.name}
                  />
                );
              }
              return null;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  },
  (prev, next) => deepEqual(prev, next)
);

MemoizedComposedChart.displayName = 'MemoizedComposedChart';
