import { useQuery, UseQueryResult } from '@tanstack/react-query'; // Assuming TanStack Query v4/v5
import { queryKeys } from './queryKeys'; // Assuming queryKeys.ts exists and exports a queryKeys object

// Define the shape of an individual ad performance object
export interface AdPerformanceData {
  ad_id: string;
  ref_code: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  spend: number;
  raised: number; // Attributed from ActBlue
  roas: number; // Raised / Spend
  profit: number; // Raised - Spend
  roi_pct: number; // (Raised - Spend) / Spend * 100
  cpa: number; // Spend / Unique Donors (assuming backend calculates unique donors)
  creative_thumbnail_url?: string;
  ad_copy_primary_text?: string;
  ad_copy_headline?: string;
  ad_copy_description?: string;
  performance_tier?: 'TOP_PERFORMER' | 'STRONG' | 'AVERAGE' | 'NEEDS_IMPROVEMENT'; // From meta_creative_insights
  key_themes?: string[]; // From meta_creative_insights
  topic?: string;
  tone?: string;
  sentiment_score?: number;
  urgency_level?: string;
  // Add other Meta ad metrics as needed
  ctr?: number;
  cpm?: number;
  cpc?: number;
  frequency?: number;
}

// Define the parameters for the query hook
interface UseAdPerformanceQueryParams {
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  // Add other filters as needed, e.g., campaignId, sortBy, sortOrder
  // Ensure that if orgId is needed, it's passed here or obtained from context
}

// Function to fetch ad performance data from the API
const fetchAdPerformance = async (
  { startDate, endDate }: UseAdPerformanceQueryParams
): Promise<AdPerformanceData[]> => {
  // Construct query parameters
  const params = new URLSearchParams({
    startDate,
    endDate,
    // Add other params here if needed, e.g., orgId
    // For now, assuming orgId is handled by the backend based on auth token or is part of a context provider
  }).toString();

  // For now, hardcoding the endpoint as specified in the plan
  const response = await fetch(`/api/v1/ad-performance?${params}`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorBody.message || `Failed to fetch ad performance: ${response.statusText}`);
  }

  return response.json();
};

export const useAdPerformanceQuery = (
  params: UseAdPerformanceQueryParams
): UseQueryResult<AdPerformanceData[], Error> => {
  return useQuery<AdPerformanceData[], Error>({
    queryKey: queryKeys.adPerformance.list(params), // Use the new query key factory
    queryFn: () => fetchAdPerformance(params),
    enabled: !!params.startDate && !!params.endDate, // Only run query if dates are provided
    // Optional: Add staleTime and gcTime for aggressive caching as per combined plan
    staleTime: 1000 * 60 * 5, // 5 minutes stale
    gcTime: 1000 * 60 * 10,  // 10 minutes cache
  });
};