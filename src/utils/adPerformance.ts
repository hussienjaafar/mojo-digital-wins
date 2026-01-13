/**
 * Ad Performance Utility Functions
 *
 * Helper functions for formatting, calculations, and display logic
 * for the Ad Performance feature.
 */

import type { AdPerformanceData, AdPerformanceTier } from '@/types/adPerformance';

/**
 * Format currency value with appropriate scaling
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

/**
 * Format ROAS multiplier
 */
export function formatRoas(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${value.toFixed(2)}x`;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * Get color class for performance tier
 */
export function getTierColor(tier: AdPerformanceTier | string | null): string {
  switch (tier) {
    case 'TOP_PERFORMER':
      return 'bg-green-500 text-white';
    case 'STRONG':
      return 'bg-blue-500 text-white';
    case 'AVERAGE':
      return 'bg-yellow-500 text-white';
    case 'NEEDS_IMPROVEMENT':
      return 'bg-red-500 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/**
 * Get display text for performance tier
 */
export function getTierLabel(tier: AdPerformanceTier | string | null): string {
  switch (tier) {
    case 'TOP_PERFORMER':
      return 'Top Performer';
    case 'STRONG':
      return 'Strong';
    case 'AVERAGE':
      return 'Average';
    case 'NEEDS_IMPROVEMENT':
      return 'Needs Improvement';
    default:
      return 'Unknown';
  }
}

/**
 * Get accent color for card based on performance tier
 */
export function getCardAccentColor(tier: AdPerformanceTier | string | null): string {
  switch (tier) {
    case 'TOP_PERFORMER':
      return 'border-l-4 border-l-green-500';
    case 'STRONG':
      return 'border-l-4 border-l-blue-500';
    case 'AVERAGE':
      return 'border-l-4 border-l-yellow-500';
    case 'NEEDS_IMPROVEMENT':
      return 'border-l-4 border-l-red-500';
    default:
      return '';
  }
}

/**
 * Get status badge variant
 */
export function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'PAUSED':
      return 'secondary';
    case 'ARCHIVED':
      return 'outline';
    default:
      return 'secondary';
  }
}

/**
 * Get ROAS color class based on value
 */
export function getRoasColor(roas: number): string {
  if (roas >= 3) return 'text-green-600 dark:text-green-400';
  if (roas >= 2) return 'text-blue-600 dark:text-blue-400';
  if (roas >= 1) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Check if ad has low spend (statistical caution)
 */
export function isLowSpend(ad: AdPerformanceData, threshold: number = 50): boolean {
  return ad.spend < threshold;
}

/**
 * Calculate performance tier from ROAS
 */
export function calculatePerformanceTier(roas: number): AdPerformanceTier {
  if (roas >= 3) return 'TOP_PERFORMER';
  if (roas >= 2) return 'STRONG';
  if (roas >= 1) return 'AVERAGE';
  return 'NEEDS_IMPROVEMENT';
}

/**
 * Sort ads by specified field
 */
export type SortField = 'spend' | 'raised' | 'roas' | 'cpa' | 'ctr';
export type SortDirection = 'asc' | 'desc';

export function sortAds(
  ads: AdPerformanceData[],
  field: SortField,
  direction: SortDirection
): AdPerformanceData[] {
  return [...ads].sort((a, b) => {
    const aValue = a[field] || 0;
    const bValue = b[field] || 0;
    return direction === 'asc' ? aValue - bValue : bValue - aValue;
  });
}

/**
 * Filter ads by minimum spend threshold
 */
export function filterByMinSpend(
  ads: AdPerformanceData[],
  minSpend: number
): AdPerformanceData[] {
  return ads.filter((ad) => ad.spend >= minSpend);
}

/**
 * Filter ads by performance tier
 */
export function filterByTier(
  ads: AdPerformanceData[],
  tiers: AdPerformanceTier[]
): AdPerformanceData[] {
  if (tiers.length === 0) return ads;
  return ads.filter((ad) => ad.performance_tier && tiers.includes(ad.performance_tier));
}
