import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  AlertTriangle,
  Target,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardContent, V3Badge } from "@/components/v3";
import { iconSizes } from "@/lib/design-tokens";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Creative {
  id: string;
  headline: string | null;
  primary_text: string | null;
  thumbnail_url: string | null;
  spend: number;
  roas: number | null;
  impressions: number;
  ctr: number | null;
  performance_tier: string | null;
}

interface CreativePerformanceQuadrantProps {
  creatives: Creative[];
  onCreativeClick?: (creative: Creative) => void;
  className?: string;
}

type Quadrant = 'scale-winner' | 'optimize' | 'watch' | 'waste';

interface QuadrantData extends Creative {
  quadrant: Quadrant;
  size: number;
}

const QUADRANT_CONFIG: Record<Quadrant, { 
  label: string; 
  description: string;
  color: string;
  bgColor: string;
  icon: typeof TrendingUp;
}> = {
  'scale-winner': {
    label: 'Scale Winners',
    description: 'High ROAS, High Spend - Your best performers',
    color: 'hsl(var(--portal-success))',
    bgColor: 'hsl(var(--portal-success)/0.15)',
    icon: TrendingUp,
  },
  'optimize': {
    label: 'Optimize',
    description: 'High ROAS, Low Spend - Increase budget',
    color: 'hsl(var(--portal-accent-blue))',
    bgColor: 'hsl(var(--portal-accent-blue)/0.15)',
    icon: Zap,
  },
  'watch': {
    label: 'Watch',
    description: 'Low ROAS, Low Spend - Monitor closely',
    color: 'hsl(var(--portal-warning))',
    bgColor: 'hsl(var(--portal-warning)/0.15)',
    icon: AlertTriangle,
  },
  'waste': {
    label: 'Waste',
    description: 'Low ROAS, High Spend - Reduce or pause',
    color: 'hsl(var(--portal-error))',
    bgColor: 'hsl(var(--portal-error)/0.15)',
    icon: TrendingDown,
  },
};

export function CreativePerformanceQuadrant({
  creatives,
  onCreativeClick,
  className,
}: CreativePerformanceQuadrantProps) {
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant | null>(null);

  const { chartData, medianSpend, medianRoas, quadrantCounts } = useMemo(() => {
    // Filter creatives with valid metrics
    const validCreatives = creatives.filter(
      c => c.spend > 0 && c.roas != null && c.roas > 0
    );

    if (validCreatives.length === 0) {
      return { chartData: [], medianSpend: 0, medianRoas: 0, quadrantCounts: {} as Record<Quadrant, number> };
    }

    // Calculate medians
    const spends = validCreatives.map(c => c.spend).sort((a, b) => a - b);
    const roases = validCreatives.map(c => c.roas!).sort((a, b) => a - b);
    
    const medianSpend = spends[Math.floor(spends.length / 2)];
    const medianRoas = roases[Math.floor(roases.length / 2)];

    // Assign quadrants
    const counts: Record<Quadrant, number> = {
      'scale-winner': 0,
      'optimize': 0,
      'watch': 0,
      'waste': 0,
    };

    const chartData: QuadrantData[] = validCreatives.map(c => {
      const isHighSpend = c.spend >= medianSpend;
      const isHighRoas = (c.roas || 0) >= medianRoas;
      
      let quadrant: Quadrant;
      if (isHighSpend && isHighRoas) quadrant = 'scale-winner';
      else if (!isHighSpend && isHighRoas) quadrant = 'optimize';
      else if (!isHighSpend && !isHighRoas) quadrant = 'watch';
      else quadrant = 'waste';

      counts[quadrant]++;

      return {
        ...c,
        quadrant,
        size: Math.max(100, Math.min(1000, c.impressions / 100)),
      };
    });

    return { chartData, medianSpend, medianRoas, quadrantCounts: counts };
  }, [creatives]);

  const filteredData = activeQuadrant 
    ? chartData.filter(d => d.quadrant === activeQuadrant)
    : chartData;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload as QuadrantData;
    const config = QUADRANT_CONFIG[data.quadrant];
    
    return (
      <div className="bg-[hsl(var(--portal-bg-primary))] border border-[hsl(var(--portal-border))] rounded-lg p-3 shadow-lg max-w-[250px]">
          <div className="flex items-start gap-2 mb-2">
            {data.thumbnail_url && (
              <img 
                src={data.thumbnail_url} 
                alt="" 
                className="w-12 h-12 rounded object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] line-clamp-2">
                {data.headline || data.primary_text?.slice(0, 40) || 'Untitled'}
              </p>
              <V3Badge 
                variant={data.quadrant === 'scale-winner' ? 'success' : 
                         data.quadrant === 'optimize' ? 'blue' :
                         data.quadrant === 'watch' ? 'pending' : 'error'} 
                size="sm"
                className="mt-1"
              >
                {config.label}
              </V3Badge>
            </div>
          </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[hsl(var(--portal-text-muted))]">Spend:</span>
            <span className="ml-1 font-medium text-[hsl(var(--portal-text-primary))]">
              ${data.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div>
            <span className="text-[hsl(var(--portal-text-muted))]">ROAS:</span>
            <span className="ml-1 font-medium text-[hsl(var(--portal-text-primary))]">
              {data.roas?.toFixed(2)}x
            </span>
          </div>
          <div>
            <span className="text-[hsl(var(--portal-text-muted))]">Impr:</span>
            <span className="ml-1 font-medium text-[hsl(var(--portal-text-primary))]">
              {data.impressions.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[hsl(var(--portal-text-muted))]">Link CTR:</span>
            <span className="ml-1 font-medium text-[hsl(var(--portal-text-primary))]">
              {data.ctr != null ? `${(data.ctr * 100).toFixed(2)}%` : '-'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (chartData.length < 4) {
    return (
      <V3Card className={cn("p-6", className)}>
        <div className="text-center py-8">
          <Target className={cn(iconSizes.xl, "mx-auto text-[hsl(var(--portal-text-muted))] mb-3")} />
          <h3 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
            Not Enough Data
          </h3>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">
            Need at least 4 creatives with spend and ROAS data to show the performance quadrant.
          </p>
        </div>
      </V3Card>
    );
  }

  return (
    <V3Card className={cn("overflow-hidden", className)}>
      <V3CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b border-[hsl(var(--portal-border)/0.5)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-[hsl(var(--portal-text-primary))] flex items-center gap-2">
              <Target className={iconSizes.md} />
              Performance Quadrant
            </h3>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger>
                  <Info className={cn(iconSizes.sm, "text-[hsl(var(--portal-text-muted))]")} />
                </TooltipTrigger>
                <TooltipContent className="max-w-[250px]">
                  <p className="text-xs">
                    Each dot is a creative. Position shows Spend (X) vs ROAS (Y). 
                    Size indicates impression volume. Click quadrant labels to filter.
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          
          {/* Quadrant Legend */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(QUADRANT_CONFIG) as [Quadrant, typeof QUADRANT_CONFIG[Quadrant]][]).map(([key, config]) => {
              const Icon = config.icon;
              const count = quadrantCounts[key] || 0;
              const isActive = activeQuadrant === key;
              
              return (
                <button
                  key={key}
                  onClick={() => setActiveQuadrant(isActive ? null : key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    isActive 
                      ? "ring-2 ring-offset-1 ring-[hsl(var(--portal-accent-blue))]"
                      : "hover:opacity-80"
                  )}
                  style={{ 
                    backgroundColor: config.bgColor,
                    color: config.color,
                  }}
                >
                  <Icon className={iconSizes.xs} />
                  {config.label}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart */}
        <div className="p-4">
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
              >
                <XAxis 
                  type="number" 
                  dataKey="spend" 
                  name="Spend"
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                  label={{ 
                    value: 'Spend →', 
                    position: 'bottom',
                    offset: 20,
                    style: { 
                      fill: 'hsl(var(--portal-text-muted))',
                      fontSize: 12,
                    }
                  }}
                  stroke="hsl(var(--portal-border))"
                  tick={{ fill: 'hsl(var(--portal-text-muted))', fontSize: 11 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="roas" 
                  name="ROAS"
                  tickFormatter={(v) => `${v.toFixed(1)}x`}
                  label={{ 
                    value: 'ROAS →', 
                    angle: -90, 
                    position: 'insideLeft',
                    offset: -45,
                    style: { 
                      fill: 'hsl(var(--portal-text-muted))',
                      fontSize: 12,
                      textAnchor: 'middle',
                    }
                  }}
                  stroke="hsl(var(--portal-border))"
                  tick={{ fill: 'hsl(var(--portal-text-muted))', fontSize: 11 }}
                />
                <ZAxis 
                  type="number" 
                  dataKey="size" 
                  range={[50, 400]} 
                />
                
                {/* Median lines */}
                <ReferenceLine 
                  x={medianSpend} 
                  stroke="hsl(var(--portal-border))" 
                  strokeDasharray="4 4"
                  label={{
                    value: 'Median Spend',
                    position: 'top',
                    style: { 
                      fill: 'hsl(var(--portal-text-muted))', 
                      fontSize: 10 
                    }
                  }}
                />
                <ReferenceLine 
                  y={medianRoas} 
                  stroke="hsl(var(--portal-border))" 
                  strokeDasharray="4 4"
                  label={{
                    value: 'Median ROAS',
                    position: 'right',
                    style: { 
                      fill: 'hsl(var(--portal-text-muted))', 
                      fontSize: 10 
                    }
                  }}
                />
                
                <Tooltip content={<CustomTooltip />} />
                
                <Scatter 
                  data={filteredData} 
                  cursor="pointer"
                  onClick={(data) => onCreativeClick?.(data)}
                >
                  {filteredData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={QUADRANT_CONFIG[entry.quadrant].color}
                      fillOpacity={0.7}
                      stroke={QUADRANT_CONFIG[entry.quadrant].color}
                      strokeWidth={1}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Footer */}
        <div className="p-4 border-t border-[hsl(var(--portal-border)/0.5)] bg-[hsl(var(--portal-bg-secondary)/0.3)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {(Object.entries(QUADRANT_CONFIG) as [Quadrant, typeof QUADRANT_CONFIG[Quadrant]][]).map(([key, config]) => {
              const count = quadrantCounts[key] || 0;
              const percent = chartData.length > 0 
                ? Math.round((count / chartData.length) * 100) 
                : 0;
              
              return (
                <div key={key}>
                  <div 
                    className="text-lg font-bold"
                    style={{ color: config.color }}
                  >
                    {percent}%
                  </div>
                  <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                    {config.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </V3CardContent>
    </V3Card>
  );
}
