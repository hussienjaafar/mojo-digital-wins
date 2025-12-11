import { useMemo } from "react";
import {
  detectAnomaliesWithContext,
  calculateTrendline,
  type AnomalyResult,
  type TrendlineResult,
} from "@/lib/analytics";

export interface AnomalyInsight {
  type: "anomaly-high" | "anomaly-low" | "trend-up" | "trend-down";
  message: string;
  date?: string;
  value?: number;
  percentChange?: number;
}

export interface UseAnomalyDetectionResult {
  anomalies: AnomalyResult[];
  trendline: TrendlineResult | null;
  insights: AnomalyInsight[];
  hasAnomalies: boolean;
  trendDirection: "up" | "down" | "flat";
}

export interface UseAnomalyDetectionOptions {
  threshold?: number;
  dateKey?: string;
  valueKey?: string;
}

export function useAnomalyDetection<T extends Record<string, any>>(
  data: T[],
  options: UseAnomalyDetectionOptions = {}
): UseAnomalyDetectionResult {
  const { threshold = 2, dateKey = "date", valueKey = "value" } = options;

  return useMemo(() => {
    if (!data || data.length < 3) {
      return {
        anomalies: [],
        trendline: null,
        insights: [],
        hasAnomalies: false,
        trendDirection: "flat",
      };
    }

    // Prepare data for analysis
    const preparedData = data.map((d) => ({
      date: String(d[dateKey] || ""),
      value: Number(d[valueKey] || 0),
    }));

    // Detect anomalies
    const anomalies = detectAnomaliesWithContext(preparedData, threshold);

    // Calculate trendline
    const values = preparedData.map((d) => d.value);
    const trendline = calculateTrendline(values);

    // Generate insights
    const insights: AnomalyInsight[] = [];

    // Add anomaly insights
    const highAnomalies = anomalies.filter((a) => a.isAnomaly && a.direction === "high");
    const lowAnomalies = anomalies.filter((a) => a.isAnomaly && a.direction === "low");

    if (highAnomalies.length > 0) {
      const mostRecent = highAnomalies[highAnomalies.length - 1];
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const percentAbove = ((mostRecent.value - mean) / mean) * 100;

      insights.push({
        type: "anomaly-high",
        message: `Spike detected: +${percentAbove.toFixed(0)}% above average`,
        date: mostRecent.date,
        value: mostRecent.value,
        percentChange: percentAbove,
      });
    }

    if (lowAnomalies.length > 0) {
      const mostRecent = lowAnomalies[lowAnomalies.length - 1];
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const percentBelow = ((mean - mostRecent.value) / mean) * 100;

      insights.push({
        type: "anomaly-low",
        message: `Drop detected: -${percentBelow.toFixed(0)}% below average`,
        date: mostRecent.date,
        value: mostRecent.value,
        percentChange: -percentBelow,
      });
    }

    // Add trend insight
    if (trendline.strength !== "weak" && trendline.direction !== "flat") {
      const firstValue = values[0];
      const lastValue = values[values.length - 1];
      const overallChange = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

      insights.push({
        type: trendline.direction === "up" ? "trend-up" : "trend-down",
        message: `${trendline.strength === "strong" ? "Strong" : "Moderate"} ${
          trendline.direction === "up" ? "upward" : "downward"
        } trend: ${overallChange > 0 ? "+" : ""}${overallChange.toFixed(0)}%`,
        percentChange: overallChange,
      });
    }

    return {
      anomalies,
      trendline,
      insights,
      hasAnomalies: anomalies.some((a) => a.isAnomaly),
      trendDirection: trendline.direction,
    };
  }, [data, threshold, dateKey, valueKey]);
}
