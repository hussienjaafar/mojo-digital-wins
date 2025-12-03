/**
 * Unified chart formatting utilities for consistent data visualization
 */

export type ValueType = 'currency' | 'number' | 'percent' | 'ratio';

/**
 * Format currency values with proper $ sign and compact notation for large numbers
 */
export function formatCurrency(value: number, compact = false): string {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (compact && absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  }
  if (compact && absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(1)}K`;
  }
  
  return `${sign}$${absValue.toLocaleString('en-US', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  })}`;
}

/**
 * Format numbers with compact notation for large values
 */
export function formatNumber(value: number, compact = false): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (compact && absValue >= 1000000) {
    return `${sign}${(absValue / 1000000).toFixed(1)}M`;
  }
  if (compact && absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(1)}K`;
  }
  
  return value.toLocaleString('en-US', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  });
}

/**
 * Format percentage values
 */
export function formatPercent(value: number, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format ratio/multiplier values (e.g., ROAS)
 */
export function formatRatio(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '0x';
  return `${value.toFixed(decimals)}x`;
}

/**
 * Smart compact formatter that chooses best format based on magnitude
 */
export function formatCompact(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1000000000) {
    return `${sign}${(absValue / 1000000000).toFixed(1)}B`;
  }
  if (absValue >= 1000000) {
    return `${sign}${(absValue / 1000000).toFixed(1)}M`;
  }
  if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(1)}K`;
  }
  if (absValue >= 1) {
    return `${sign}${absValue.toFixed(0)}`;
  }
  return `${sign}${absValue.toFixed(2)}`;
}

/**
 * Get Y-axis tick formatter for Recharts
 */
export function getYAxisFormatter(type: ValueType): (value: number) => string {
  switch (type) {
    case 'currency':
      return (value) => formatCurrency(value, true);
    case 'percent':
      return (value) => formatPercent(value, 0);
    case 'ratio':
      return (value) => formatRatio(value, 1);
    case 'number':
    default:
      return (value) => formatNumber(value, true);
  }
}

/**
 * Get tooltip value formatter for Recharts
 */
export function getTooltipFormatter(type: ValueType): (value: number) => string {
  switch (type) {
    case 'currency':
      return (value) => formatCurrency(value, false);
    case 'percent':
      return (value) => formatPercent(value, 1);
    case 'ratio':
      return (value) => formatRatio(value, 2);
    case 'number':
    default:
      return (value) => formatNumber(value, false);
  }
}

/**
 * Format value based on type - convenience function
 */
export function formatValue(value: number, type: ValueType, compact = false): string {
  switch (type) {
    case 'currency':
      return formatCurrency(value, compact);
    case 'percent':
      return formatPercent(value);
    case 'ratio':
      return formatRatio(value);
    case 'number':
    default:
      return formatNumber(value, compact);
  }
}

/**
 * Get domain padding for Y-axis based on data
 */
export function getYAxisDomain(data: number[]): [number, number] {
  if (!data || data.length === 0) return [0, 100];
  
  const min = Math.min(...data.filter(v => !isNaN(v)));
  const max = Math.max(...data.filter(v => !isNaN(v)));
  
  const padding = (max - min) * 0.1;
  
  return [
    Math.max(0, Math.floor(min - padding)),
    Math.ceil(max + padding)
  ];
}

/**
 * Reduce data points for mobile display
 */
export function reduceDataPoints<T>(data: T[], maxPoints: number): T[] {
  if (!data || data.length <= maxPoints) return data;
  
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0);
}
