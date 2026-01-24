/**
 * Ad Hierarchy Types
 * 
 * Types for Campaign → Ad Set → Ad hierarchical navigation
 * Mirrors Meta Ads Manager drill-down functionality
 */

import type { AdPerformanceData } from './adPerformance';

/**
 * Hierarchy levels for navigation
 */
export type HierarchyLevel = 'campaign' | 'adset' | 'ad';

/**
 * Campaign-level aggregated metrics
 */
export interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective?: string;
  total_spend: number;
  total_raised: number;
  total_roas: number;
  total_impressions: number;
  total_clicks: number;
  total_link_clicks: number;
  unique_donors: number;
  donation_count: number;
  avg_cpa: number;
  avg_ctr: number;
  adset_count: number;
  ad_count: number;
}

/**
 * Ad Set-level aggregated metrics
 */
export interface AdSetMetrics {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  total_spend: number;
  total_raised: number;
  total_roas: number;
  total_impressions: number;
  total_clicks: number;
  total_link_clicks: number;
  unique_donors: number;
  donation_count: number;
  avg_cpa: number;
  avg_ctr: number;
  ad_count: number;
}

/**
 * Navigation state for drill-down
 */
export interface HierarchyNavigationState {
  level: HierarchyLevel;
  selectedCampaigns: string[];
  selectedAdsets: string[];
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Breadcrumb navigation item
 */
export interface BreadcrumbItem {
  level: HierarchyLevel;
  id?: string;
  name: string;
}

/**
 * Hierarchy result containing all levels
 */
export interface AdHierarchyResult {
  campaigns: CampaignMetrics[];
  adsets: AdSetMetrics[];
  ads: AdPerformanceData[];
}
