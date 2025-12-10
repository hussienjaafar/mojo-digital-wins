import { format, parseISO, subDays, differenceInDays } from 'date-fns';

export type MetricTrend = {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
};

export type CohortData = {
  cohort: string;
  acquisitionChannel: string;
  totalDonors: number;
  totalRevenue: number;
  avgLifetimeValue: number;
  retentionRate: number;
};

export type AttributionData = {
  touchpoint: string;
  platform: string;
  firstTouch: number;
  lastTouch: number;
  linear: number;
  positionBased: number;
  timeDecay: number;
};

export type ForecastData = {
  date: string;
  actual?: number;
  forecast: number;
  lowerBound: number;
  upperBound: number;
};

/**
 * Calculate trend comparing current vs previous period
 */
export function calculateTrend(
  currentValue: number,
  previousValue: number
): MetricTrend {
  const change = currentValue - previousValue;
  const changePercent = previousValue !== 0 
    ? (change / previousValue) * 100 
    : 0;

  return {
    current: currentValue,
    previous: previousValue,
    change,
    changePercent,
  };
}

/**
 * Calculate Customer Acquisition Cost (CAC)
 */
export function calculateCAC(totalSpend: number, newDonors: number): number {
  return newDonors > 0 ? totalSpend / newDonors : 0;
}

/**
 * Calculate Lifetime Value (LTV)
 */
export function calculateLTV(
  avgDonation: number,
  donationsPerYear: number,
  retentionYears: number
): number {
  return avgDonation * donationsPerYear * retentionYears;
}

/**
 * Simple linear regression for forecasting
 */
export function forecastTrend(
  data: { date: string; value: number }[],
  daysToForecast: number
): ForecastData[] {
  if (data.length < 2) return [];

  // Calculate linear regression
  const n = data.length;
  const xValues = data.map((_, i) => i);
  const yValues = data.map(d => d.value);
  
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate standard error for confidence intervals
  const predictions = xValues.map(x => slope * x + intercept);
  const errors = yValues.map((y, i) => y - predictions[i]);
  const mse = errors.reduce((sum, e) => sum + e * e, 0) / n;
  const stdError = Math.sqrt(mse);
  
  // Generate forecast
  const lastDate = parseISO(data[data.length - 1].date);
  const forecast: ForecastData[] = [];
  
  // Include actual data with forecast line
  data.forEach((d, i) => {
    forecast.push({
      date: d.date,
      actual: d.value,
      forecast: predictions[i],
      lowerBound: predictions[i] - 1.96 * stdError,
      upperBound: predictions[i] + 1.96 * stdError,
    });
  });
  
  // Add future forecasts
  for (let i = 1; i <= daysToForecast; i++) {
    const x = n + i - 1;
    const forecastValue = slope * x + intercept;
    const date = format(subDays(lastDate, -i), 'yyyy-MM-dd');
    
    forecast.push({
      date,
      forecast: forecastValue,
      lowerBound: forecastValue - 1.96 * stdError,
      upperBound: forecastValue + 1.96 * stdError,
    });
  }
  
  return forecast;
}

/**
 * Anomaly detection result with context
 */
export interface AnomalyResult {
  index: number;
  value: number;
  zScore: number;
  isAnomaly: boolean;
  direction: 'high' | 'low' | 'normal';
  date?: string;
}

/**
 * Detect anomalies using z-score with detailed results
 */
export function detectAnomaliesWithContext(
  data: { date: string; value: number }[],
  threshold: number = 2
): AnomalyResult[] {
  if (data.length < 3) return data.map((d, i) => ({
    index: i,
    value: d.value,
    zScore: 0,
    isAnomaly: false,
    direction: 'normal' as const,
    date: d.date,
  }));

  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return data.map((d, i) => {
    const zScore = stdDev > 0 ? (d.value - mean) / stdDev : 0;
    const isAnomaly = Math.abs(zScore) > threshold;
    
    return {
      index: i,
      value: d.value,
      zScore,
      isAnomaly,
      direction: zScore > threshold ? 'high' : zScore < -threshold ? 'low' : 'normal',
      date: d.date,
    };
  });
}

/**
 * Simple anomaly detection returning boolean array
 */
export function detectAnomalies(
  data: number[],
  threshold: number = 2
): boolean[] {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  
  return data.map(val => Math.abs(val - mean) > threshold * stdDev);
}

/**
 * Linear regression result
 */
export interface TrendlineResult {
  slope: number;
  intercept: number;
  rSquared: number;
  direction: 'up' | 'down' | 'flat';
  strength: 'strong' | 'moderate' | 'weak';
  predictedValues: number[];
}

/**
 * Calculate trendline with regression metrics
 */
export function calculateTrendline(
  data: number[]
): TrendlineResult {
  const n = data.length;
  if (n < 2) {
    return {
      slope: 0,
      intercept: data[0] || 0,
      rSquared: 0,
      direction: 'flat',
      strength: 'weak',
      predictedValues: data,
    };
  }

  const xValues = data.map((_, i) => i);
  const yValues = data;
  
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const predictions = xValues.map(x => slope * x + intercept);
  const ssRes = yValues.reduce((sum, y, i) => sum + Math.pow(y - predictions[i], 2), 0);
  const rSquared = ssTotal > 0 ? 1 - (ssRes / ssTotal) : 0;
  
  // Determine direction and strength
  const direction = Math.abs(slope) < 0.001 ? 'flat' : slope > 0 ? 'up' : 'down';
  const strength = rSquared > 0.7 ? 'strong' : rSquared > 0.4 ? 'moderate' : 'weak';
  
  return {
    slope,
    intercept,
    rSquared,
    direction,
    strength,
    predictedValues: predictions,
  };
}

/**
 * Compute rolling average for any field in data array
 */
export function computeRollingAverage<T extends Record<string, any>>(
  data: T[],
  field: keyof T,
  window: number
): (T & { rollingAvg: number })[] {
  return data.map((item, i) => {
    const start = Math.max(0, i - window + 1);
    const windowData = data.slice(start, i + 1);
    const avg = windowData.reduce((sum, d) => sum + Number(d[field] || 0), 0) / windowData.length;
    return { ...item, rollingAvg: avg };
  });
}

/**
 * Calculate cumulative sum
 */
export function calculateCumulativeSum<T extends Record<string, any>>(
  data: T[],
  field: keyof T
): (T & { cumulative: number })[] {
  let cumulative = 0;
  return data.map(item => {
    cumulative += Number(item[field] || 0);
    return { ...item, cumulative };
  });
}

/**
 * Calculate day-over-day percent change
 */
export function calculatePercentChange<T extends Record<string, any>>(
  data: T[],
  field: keyof T
): (T & { percentChange: number })[] {
  return data.map((item, i) => {
    if (i === 0) return { ...item, percentChange: 0 };
    const prev = Number(data[i - 1][field] || 0);
    const current = Number(item[field] || 0);
    const percentChange = prev !== 0 ? ((current - prev) / prev) * 100 : 0;
    return { ...item, percentChange };
  });
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(
  data: number[],
  windowSize: number
): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    result.push(avg);
  }
  
  return result;
}

/**
 * Group data by time period
 */
export function groupByPeriod<T>(
  data: T[],
  dateField: keyof T,
  period: 'day' | 'week' | 'month',
  aggregator: (items: T[]) => any
): any[] {
  if (!data || data.length === 0) return [];
  
  const groups = new Map<string, T[]>();
  
  data.forEach(item => {
    const dateValue = item[dateField] as string;
    if (!dateValue) return; // Skip items with undefined/null date
    
    const date = parseISO(dateValue);
    let key: string;
    
    if (period === 'day') {
      key = format(date, 'yyyy-MM-dd');
    } else if (period === 'week') {
      // Start of week (Monday)
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(date.setDate(diff));
      key = format(weekStart, 'yyyy-MM-dd');
    } else {
      key = format(date, 'yyyy-MM');
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  });
  
  return Array.from(groups.entries()).map(([key, items]) => ({
    period: key,
    ...aggregator(items),
  }));
}

/**
 * Calculate channel contribution using Shapley value approximation
 */
export function calculateChannelContribution(
  channels: { name: string; conversions: number; spend: number }[]
): { name: string; contribution: number; efficiency: number }[] {
  const totalConversions = channels.reduce((sum, c) => sum + c.conversions, 0);
  const totalSpend = channels.reduce((sum, c) => sum + c.spend, 0);
  
  return channels.map(channel => ({
    name: channel.name,
    contribution: totalConversions > 0 
      ? (channel.conversions / totalConversions) * 100 
      : 0,
    efficiency: channel.spend > 0 
      ? channel.conversions / channel.spend 
      : 0,
  }));
}

/**
 * Export data to CSV
 */
export function exportToCSV(
  data: any[],
  filename: string = 'export.csv'
): void {
  if (data.length === 0) return;
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csv = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape values containing commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
