import { useMemo } from "react";
import { Target } from "lucide-react";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { EChartsBase } from "@/components/charts/echarts/EChartsBase";
import { V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent } from "@/components/v3/V3Card";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import type { CreativeRecommendation } from "@/hooks/useCreativeIntelligence";

interface PerformanceQuadrantChartProps {
  recommendations: CreativeRecommendation[];
  isLoading?: boolean;
}

export function PerformanceQuadrantChart({ recommendations, isLoading }: PerformanceQuadrantChartProps) {
  const { chartOption, quadrantCounts } = useMemo(() => {
    if (!recommendations.length) {
      return { chartOption: null, quadrantCounts: { scale: 0, maintain: 0, watch: 0, pause: 0 } };
    }

    // Calculate medians for quadrant thresholds
    const spends = recommendations.map((r) => r.total_spend).sort((a, b) => a - b);
    const roases = recommendations.map((r) => r.roas).sort((a, b) => a - b);
    const medianSpend = spends[Math.floor(spends.length / 2)];
    const medianRoas = roases[Math.floor(roases.length / 2)];

    // Use 1.0 as ROAS threshold (break-even) if median is below it
    const roasThreshold = Math.max(medianRoas, 1.0);

    // Categorize into quadrants
    const quadrantCounts = { scale: 0, maintain: 0, watch: 0, pause: 0 };

    const scatterData = recommendations.map((r) => {
      const highRoas = r.roas >= roasThreshold;
      const highSpend = r.total_spend >= medianSpend;

      let quadrant: keyof typeof quadrantCounts;
      let color: string;

      if (highRoas && highSpend) {
        quadrant = "scale";
        color = "hsl(var(--portal-success))";
      } else if (highRoas && !highSpend) {
        quadrant = "maintain";
        color = "hsl(var(--portal-accent-blue))";
      } else if (!highRoas && !highSpend) {
        quadrant = "watch";
        color = "hsl(var(--portal-warning))";
      } else {
        quadrant = "pause";
        color = "hsl(var(--portal-error))";
      }

      quadrantCounts[quadrant]++;

      return {
        value: [r.total_spend, r.roas],
        name: r.headline || r.issue_primary || "Creative",
        creative_id: r.creative_id,
        quadrant,
        itemStyle: { color },
        // Store additional data for tooltip
        data: {
          spend: r.total_spend,
          roas: r.roas,
          revenue: r.total_revenue,
          impressions: r.total_impressions,
          recommendation: r.recommendation,
        },
      };
    });

    const maxSpend = Math.max(...spends) * 1.1;
    const maxRoas = Math.max(...roases) * 1.1;

    const chartOption = {
      animation: true,
      tooltip: {
        trigger: "item",
        backgroundColor: "hsl(var(--portal-bg-secondary) / 0.95)",
        borderColor: "hsl(var(--portal-border) / 0.5)",
        borderWidth: 1,
        padding: 12,
        extraCssText: `
          border-radius: 8px;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `,
        formatter: (params: any) => {
          const d = params.data.data;
          return `
            <div style="font-weight: 600; margin-bottom: 8px;">${params.name}</div>
            <div style="display: grid; gap: 4px; font-size: 12px;">
              <div><span style="color: hsl(var(--portal-text-muted));">ROAS:</span> <strong>${d.roas.toFixed(2)}x</strong></div>
              <div><span style="color: hsl(var(--portal-text-muted));">Spend:</span> $${d.spend.toLocaleString()}</div>
              <div><span style="color: hsl(var(--portal-text-muted));">Revenue:</span> $${d.revenue.toLocaleString()}</div>
              <div><span style="color: hsl(var(--portal-text-muted));">Action:</span> ${d.recommendation.replace(/_/g, " ")}</div>
            </div>
          `;
        },
      },
      grid: {
        left: 60,
        right: 40,
        top: 40,
        bottom: 60,
      },
      xAxis: {
        type: "value",
        name: "Spend ($)",
        nameLocation: "middle",
        nameGap: 35,
        nameTextStyle: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 12,
        },
        max: maxSpend,
        axisLine: { lineStyle: { color: "hsl(var(--portal-border))" } },
        axisTick: { show: false },
        axisLabel: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 11,
          formatter: (value: number) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`,
        },
        splitLine: {
          lineStyle: { color: "hsl(var(--portal-border))", type: "dashed" },
        },
      },
      yAxis: {
        type: "value",
        name: "ROAS",
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 12,
        },
        max: maxRoas,
        axisLine: { lineStyle: { color: "hsl(var(--portal-border))" } },
        axisTick: { show: false },
        axisLabel: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 11,
          formatter: (value: number) => `${value.toFixed(1)}x`,
        },
        splitLine: {
          lineStyle: { color: "hsl(var(--portal-border))", type: "dashed" },
        },
      },
      // Quadrant lines
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: {
          color: "hsl(var(--portal-text-muted))",
          type: "dashed",
          width: 1,
        },
        data: [
          { xAxis: medianSpend },
          { yAxis: roasThreshold },
        ],
      },
      series: [
        {
          type: "scatter",
          data: scatterData,
          symbolSize: (data: number[]) => {
            // Size based on spend
            const minSize = 12;
            const maxSize = 40;
            const ratio = Math.min(data[0] / maxSpend, 1);
            return minSize + ratio * (maxSize - minSize);
          },
          emphasis: {
            focus: "self",
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: {
              color: "hsl(var(--portal-text-muted))",
              type: "dashed",
              width: 1,
            },
            data: [
              { xAxis: medianSpend },
              { yAxis: roasThreshold },
            ],
          },
          markArea: {
            silent: true,
            data: [
              // Scale quadrant (top-right)
              [
                {
                  xAxis: medianSpend,
                  yAxis: roasThreshold,
                  itemStyle: { color: "hsla(var(--portal-success), 0.05)" },
                },
                { xAxis: maxSpend, yAxis: maxRoas },
              ],
              // Maintain quadrant (top-left)
              [
                {
                  xAxis: 0,
                  yAxis: roasThreshold,
                  itemStyle: { color: "hsla(var(--portal-accent-blue), 0.05)" },
                },
                { xAxis: medianSpend, yAxis: maxRoas },
              ],
              // Watch quadrant (bottom-left)
              [
                {
                  xAxis: 0,
                  yAxis: 0,
                  itemStyle: { color: "hsla(var(--portal-warning), 0.05)" },
                },
                { xAxis: medianSpend, yAxis: roasThreshold },
              ],
              // Pause quadrant (bottom-right)
              [
                {
                  xAxis: medianSpend,
                  yAxis: 0,
                  itemStyle: { color: "hsla(var(--portal-error), 0.05)" },
                },
                { xAxis: maxSpend, yAxis: roasThreshold },
              ],
            ],
          },
        },
      ],
    };

    return { chartOption, quadrantCounts };
  }, [recommendations]);

  // Generate accessible summary of chart data
  const getChartSummary = () => {
    const total = quadrantCounts.scale + quadrantCounts.maintain + quadrantCounts.watch + quadrantCounts.pause;
    return `Performance quadrant chart showing ${total} creatives: ${quadrantCounts.scale} in Scale (high ROAS, high spend), ${quadrantCounts.maintain} in Maintain (high ROAS, low spend), ${quadrantCounts.watch} in Watch (low ROAS, low spend), ${quadrantCounts.pause} in Pause (low ROAS, high spend)`;
  };

  if (isLoading) {
    return (
      <V3Card role="region" aria-label="Performance quadrant chart">
        <V3CardHeader>
          <V3CardTitle>Performance Quadrant</V3CardTitle>
        </V3CardHeader>
        <V3CardContent>
          <V3LoadingState variant="chart" height={400} />
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card role="region" aria-label="Performance quadrant chart">
      <V3CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" aria-hidden="true" />
          <V3CardTitle id="quadrant-chart-title">Performance Quadrant</V3CardTitle>
        </div>
        <V3CardDescription id="quadrant-chart-desc">
          Strategic view: Spend vs ROAS mapping. Bubble size indicates relative spend.
        </V3CardDescription>
      </V3CardHeader>
      <V3CardContent>
        {/* Quadrant legend */}
        <div
          className="flex flex-wrap gap-4 mb-4"
          role="list"
          aria-label="Chart legend showing quadrant categories"
        >
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--portal-success))]" aria-hidden="true" />
            <span className="text-sm">Scale ({quadrantCounts.scale})</span>
            <span className="sr-only">: High ROAS and high spend creatives recommended for scaling</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--portal-accent-blue))]" aria-hidden="true" />
            <span className="text-sm">Maintain ({quadrantCounts.maintain})</span>
            <span className="sr-only">: High ROAS but low spend creatives to maintain</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--portal-warning))]" aria-hidden="true" />
            <span className="text-sm">Watch ({quadrantCounts.watch})</span>
            <span className="sr-only">: Low ROAS and low spend creatives to monitor</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--portal-error))]" aria-hidden="true" />
            <span className="text-sm">Pause ({quadrantCounts.pause})</span>
            <span className="sr-only">: Low ROAS but high spend creatives to consider pausing</span>
          </div>
        </div>

        {chartOption ? (
          <div
            role="img"
            aria-label={getChartSummary()}
            aria-describedby="quadrant-chart-desc"
          >
            <EChartsBase option={chartOption} height={400} />
            {/* Screen reader accessible data table */}
            <div className="sr-only">
              <table>
                <caption>Performance quadrant distribution</caption>
                <thead>
                  <tr>
                    <th>Quadrant</th>
                    <th>Count</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Scale</td>
                    <td>{quadrantCounts.scale}</td>
                    <td>High ROAS, high spend - recommended for scaling</td>
                  </tr>
                  <tr>
                    <td>Maintain</td>
                    <td>{quadrantCounts.maintain}</td>
                    <td>High ROAS, low spend - maintain current performance</td>
                  </tr>
                  <tr>
                    <td>Watch</td>
                    <td>{quadrantCounts.watch}</td>
                    <td>Low ROAS, low spend - monitor for improvement</td>
                  </tr>
                  <tr>
                    <td>Pause</td>
                    <td>{quadrantCounts.pause}</td>
                    <td>Low ROAS, high spend - consider pausing</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div
            className="h-[400px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]"
            role="status"
            aria-label="No chart data available"
          >
            No data available for quadrant analysis
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
}
