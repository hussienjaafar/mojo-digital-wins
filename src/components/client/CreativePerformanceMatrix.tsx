import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, TrendingUp, Target } from "lucide-react";
import { 
  V3Card, 
  V3CardHeader, 
  V3CardTitle, 
  V3CardDescription, 
  V3CardContent, 
  V3Badge 
} from "@/components/v3";
import { iconSizes, getHeatmapColor } from "@/lib/design-tokens";

type Creative = {
  id: string;
  topic: string | null;
  tone: string | null;
  urgency_level: string | null;
  emotional_appeal: string | null;
  roas: number | null;
  ctr: number | null;
  impressions: number;
  conversions: number;
};

type Props = {
  creatives: Creative[];
  dimension: 'topic-tone' | 'emotional-urgency';
};

type MatrixCell = {
  rowKey: string;
  colKey: string;
  avgRoas: number;
  avgCtr: number;
  count: number;
  conversions: number;
  totalImpressions?: number;
};

export function CreativePerformanceMatrix({ creatives, dimension }: Props) {
  const { matrix, rows, cols, insights } = useMemo(() => {
    const cells: Record<string, MatrixCell> = {};
    const rowSet = new Set<string>();
    const colSet = new Set<string>();

    // Determine which fields to use
    const [rowField, colField] = dimension === 'topic-tone' 
      ? ['topic', 'tone'] 
      : ['emotional_appeal', 'urgency_level'];

    // Build matrix with WEIGHTED averages (Phase 3 improvement)
    // Use impressions as weights to avoid small sample bias
    creatives.forEach(c => {
      const rowKey = (c[rowField as keyof Creative] as string) || 'Unknown';
      const colKey = (c[colField as keyof Creative] as string) || 'Unknown';
      
      rowSet.add(rowKey);
      colSet.add(colKey);

      const key = `${rowKey}|${colKey}`;
      if (!cells[key]) {
        cells[key] = { rowKey, colKey, avgRoas: 0, avgCtr: 0, count: 0, conversions: 0, totalImpressions: 0 };
      }
      
      const impressions = c.impressions || 0;
      cells[key].count++;
      // Weighted sum for proper averaging later
      cells[key].avgRoas += (c.roas || 0) * impressions;
      cells[key].avgCtr += (c.ctr || 0) * impressions;
      cells[key].conversions += c.conversions || 0;
      cells[key].totalImpressions! += impressions;
    });

    // Calculate weighted averages (more accurate than simple average)
    Object.values(cells).forEach(cell => {
      const totalImpressions = cell.totalImpressions || 1;
      if (cell.count > 0 && totalImpressions > 0) {
        cell.avgRoas = cell.avgRoas / totalImpressions;
        cell.avgCtr = cell.avgCtr / totalImpressions;
      }
    });

    // Generate insights
    const sortedByRoas = Object.values(cells).filter(c => c.count >= 2).sort((a, b) => b.avgRoas - a.avgRoas);
    const topCombos = sortedByRoas.slice(0, 3);
    const worstCombos = sortedByRoas.slice(-3).reverse();

    return {
      matrix: cells,
      rows: Array.from(rowSet).sort(),
      cols: Array.from(colSet).sort(),
      insights: { topCombos, worstCombos }
    };
  }, [creatives, dimension]);

  const maxRoas = Math.max(...Object.values(matrix).map(c => c.avgRoas), 0);

  const rowLabel = dimension === 'topic-tone' ? 'Topic' : 'Emotional Appeal';
  const colLabel = dimension === 'topic-tone' ? 'Tone' : 'Urgency Level';

  return (
    <div className="space-y-6">
      {/* Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <V3Card accent="green">
          <V3CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className={cn(iconSizes.md, "text-[hsl(var(--portal-success))]")} />
              <V3CardTitle>Top Performing Combinations</V3CardTitle>
            </div>
            <V3CardDescription>Highest ROAS combinations with 2+ creatives</V3CardDescription>
          </V3CardHeader>
          <V3CardContent>
            <div className="space-y-3">
              {insights.topCombos.map((combo, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--portal-success)/0.1)] border border-[hsl(var(--portal-success)/0.2)]"
                >
                  <div className="flex items-center gap-2">
                    <V3Badge variant="outline" className="capitalize">{combo.rowKey}</V3Badge>
                    <span className="text-[hsl(var(--portal-text-muted))]">+</span>
                    <V3Badge variant="outline" className="capitalize">{combo.colKey}</V3Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[hsl(var(--portal-success))]">${combo.avgRoas.toFixed(2)} ROAS</div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">{combo.count} creatives</div>
                  </div>
                </div>
              ))}
              {insights.topCombos.length === 0 && (
                <p className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-4">
                  Need more analyzed creatives to show insights
                </p>
              )}
            </div>
          </V3CardContent>
        </V3Card>

        <V3Card accent="amber">
          <V3CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className={cn(iconSizes.md, "text-[hsl(var(--portal-warning))]")} />
              <V3CardTitle>Opportunities to Improve</V3CardTitle>
            </div>
            <V3CardDescription>Combinations with potential for optimization</V3CardDescription>
          </V3CardHeader>
          <V3CardContent>
            <div className="space-y-3">
              {insights.worstCombos.map((combo, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--portal-warning)/0.1)] border border-[hsl(var(--portal-warning)/0.2)]"
                >
                  <div className="flex items-center gap-2">
                    <V3Badge variant="outline" className="capitalize">{combo.rowKey}</V3Badge>
                    <span className="text-[hsl(var(--portal-text-muted))]">+</span>
                    <V3Badge variant="outline" className="capitalize">{combo.colKey}</V3Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[hsl(var(--portal-warning))]">${combo.avgRoas.toFixed(2)} ROAS</div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">{combo.count} creatives</div>
                  </div>
                </div>
              ))}
              {insights.worstCombos.length === 0 && (
                <p className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-4">
                  Need more analyzed creatives to show insights
                </p>
              )}
            </div>
          </V3CardContent>
        </V3Card>
      </div>

      {/* Heatmap Matrix */}
      <V3Card>
        <V3CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className={cn(iconSizes.md, "text-[hsl(var(--portal-accent-blue))]")} />
            <V3CardTitle>Performance Heatmap</V3CardTitle>
          </div>
          <V3CardDescription>
            {rowLabel} × {colLabel} performance matrix (darker = higher ROAS)
          </V3CardDescription>
        </V3CardHeader>
        <V3CardContent>
          {rows.length === 0 || cols.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--portal-text-muted))]">
              <BarChart3 className={cn(iconSizes['2xl'], "mx-auto mb-3 opacity-50")} />
              <p>Analyze your creatives to generate the performance matrix</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-xs font-medium text-[hsl(var(--portal-text-muted))] border-b border-[hsl(var(--portal-border))]">
                      {rowLabel} \ {colLabel}
                    </th>
                    {cols.map(col => (
                      <th key={col} className="p-2 text-center text-xs font-medium capitalize border-b border-[hsl(var(--portal-border))] min-w-[80px] text-[hsl(var(--portal-text-primary))]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row}>
                      <td className="p-2 text-sm font-medium capitalize border-r border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]">
                        {row}
                      </td>
                      {cols.map(col => {
                        const cell = matrix[`${row}|${col}`];
                        const intensity = cell && maxRoas > 0 ? Math.min(cell.avgRoas / maxRoas, 1) : 0;
                        return (
                          <td key={col} className="p-1">
                            {cell && cell.count > 0 ? (
                              <div 
                                className={cn(
                                  "p-2 rounded text-center transition-all hover:scale-105",
                                  getHeatmapColor(intensity)
                                )}
                                title={`${cell.count} creatives, ${cell.conversions} conversions`}
                              >
                                <div className="text-sm font-bold">${cell.avgRoas.toFixed(2)}</div>
                                <div className="text-xs opacity-80">{cell.count} ads</div>
                              </div>
                            ) : (
                              <div className="p-2 text-center text-xs text-[hsl(var(--portal-text-muted))]">
                                -
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-[hsl(var(--portal-text-muted))]">
            <span>Low ROAS</span>
            <div className="flex gap-1">
              <div className="w-6 h-4 rounded bg-[hsl(var(--portal-error)/0.2)]" />
              <div className="w-6 h-4 rounded bg-[hsl(var(--portal-warning)/0.4)]" />
              <div className="w-6 h-4 rounded bg-[hsl(var(--portal-success)/0.4)]" />
              <div className="w-6 h-4 rounded bg-[hsl(var(--portal-success)/0.8)]" />
            </div>
            <span>High ROAS</span>
          </div>
        </V3CardContent>
      </V3Card>
    </div>
  );
}
