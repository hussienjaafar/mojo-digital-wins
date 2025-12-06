import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BarChart3, TrendingUp, Target, Zap } from "lucide-react";

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
        cells[key] = { rowKey, colKey, avgRoas: 0, avgCtr: 0, count: 0, conversions: 0, totalImpressions: 0 } as MatrixCell & { totalImpressions: number };
      }
      
      const impressions = c.impressions || 0;
      cells[key].count++;
      // Weighted sum for proper averaging later
      cells[key].avgRoas += (c.roas || 0) * impressions;
      cells[key].avgCtr += (c.ctr || 0) * impressions;
      cells[key].conversions += c.conversions || 0;
      (cells[key] as any).totalImpressions += impressions;
    });

    // Calculate weighted averages (more accurate than simple average)
    Object.values(cells).forEach(cell => {
      const totalImpressions = (cell as any).totalImpressions || 1;
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

  const getHeatColor = (roas: number, maxRoas: number) => {
    if (maxRoas === 0) return 'bg-muted';
    const intensity = Math.min(roas / maxRoas, 1);
    if (intensity >= 0.75) return 'bg-green-500/80 text-white';
    if (intensity >= 0.5) return 'bg-green-500/40';
    if (intensity >= 0.25) return 'bg-yellow-500/40';
    return 'bg-red-500/20';
  };

  const maxRoas = Math.max(...Object.values(matrix).map(c => c.avgRoas), 0);

  const rowLabel = dimension === 'topic-tone' ? 'Topic' : 'Emotional Appeal';
  const colLabel = dimension === 'topic-tone' ? 'Tone' : 'Urgency Level';

  return (
    <div className="space-y-6">
      {/* Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">Top Performing Combinations</CardTitle>
            </div>
            <CardDescription>Highest ROAS combinations with 2+ creatives</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.topCombos.map((combo, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{combo.rowKey}</Badge>
                    <span className="text-muted-foreground">+</span>
                    <Badge variant="outline" className="capitalize">{combo.colKey}</Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">${combo.avgRoas.toFixed(2)} ROAS</div>
                    <div className="text-xs text-muted-foreground">{combo.count} creatives</div>
                  </div>
                </div>
              ))}
              {insights.topCombos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Need more analyzed creatives to show insights
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Opportunities to Improve</CardTitle>
            </div>
            <CardDescription>Combinations with potential for optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.worstCombos.map((combo, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{combo.rowKey}</Badge>
                    <span className="text-muted-foreground">+</span>
                    <Badge variant="outline" className="capitalize">{combo.colKey}</Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-600">${combo.avgRoas.toFixed(2)} ROAS</div>
                    <div className="text-xs text-muted-foreground">{combo.count} creatives</div>
                  </div>
                </div>
              ))}
              {insights.worstCombos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Need more analyzed creatives to show insights
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap Matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Performance Heatmap</CardTitle>
          </div>
          <CardDescription>
            {rowLabel} × {colLabel} performance matrix (darker = higher ROAS)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 || cols.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Analyze your creatives to generate the performance matrix</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground border-b">
                      {rowLabel} \ {colLabel}
                    </th>
                    {cols.map(col => (
                      <th key={col} className="p-2 text-center text-xs font-medium capitalize border-b min-w-[80px]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row}>
                      <td className="p-2 text-sm font-medium capitalize border-r">
                        {row}
                      </td>
                      {cols.map(col => {
                        const cell = matrix[`${row}|${col}`];
                        return (
                          <td key={col} className="p-1">
                            {cell && cell.count > 0 ? (
                              <div 
                                className={cn(
                                  "p-2 rounded text-center transition-all hover:scale-105",
                                  getHeatColor(cell.avgRoas, maxRoas)
                                )}
                                title={`${cell.count} creatives, ${cell.conversions} conversions`}
                              >
                                <div className="text-sm font-bold">${cell.avgRoas.toFixed(2)}</div>
                                <div className="text-xs opacity-80">{cell.count} ads</div>
                              </div>
                            ) : (
                              <div className="p-2 text-center text-xs text-muted-foreground">
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
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-muted-foreground">
            <span>Low ROAS</span>
            <div className="flex gap-1">
              <div className="w-6 h-4 rounded bg-red-500/20" />
              <div className="w-6 h-4 rounded bg-yellow-500/40" />
              <div className="w-6 h-4 rounded bg-green-500/40" />
              <div className="w-6 h-4 rounded bg-green-500/80" />
            </div>
            <span>High ROAS</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
