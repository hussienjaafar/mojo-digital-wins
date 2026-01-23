import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { 
  FilterCondition, 
  SegmentDonor, 
  SegmentAggregates, 
  SavedSegment 
} from "@/types/donorSegment";

const SEGMENT_QUERY_KEY = 'donor-segment';
const SAVED_SEGMENTS_KEY = 'saved-segments';

interface SegmentQueryResult {
  donors: SegmentDonor[];
  aggregates: SegmentAggregates;
  totalCount: number;
}

// Build dynamic query based on filter conditions
async function fetchSegmentDonors(
  organizationId: string,
  filters: FilterCondition[],
  limit: number = 1000
): Promise<SegmentQueryResult> {
  const sb = supabase as any;

  // First, fetch donor demographics with LTV predictions
  let query = sb
    .from('donor_demographics')
    .select(`
      id,
      donor_key,
      email,
      full_name,
      state,
      city,
      zip,
      total_donated,
      donation_count,
      first_donation_date,
      last_donation_date,
      is_recurring,
      employer,
      occupation,
      donor_ltv_predictions!left(
        segment,
        churn_risk_label,
        predicted_ltv_90,
        predicted_ltv_180
      )
    `)
    .eq('organization_id', organizationId);

  // Apply filters to the query
  for (const filter of filters) {
    const { field, operator, value } = filter;
    
    // Handle LTV prediction fields separately (they're in a joined table)
    const ltvFields = ['segment', 'churn_risk_label', 'predicted_ltv_90', 'predicted_ltv_180'];
    const isLtvField = ltvFields.includes(field);
    
    // Skip LTV fields for now - we'll filter client-side
    // This is because Supabase doesn't support filtering on joined table columns in the same way
    if (isLtvField) continue;
    
    // Handle computed fields client-side
    if (field === 'days_since_donation' || field === 'avg_donation' || field === 'donor_tier') {
      continue;
    }

    switch (operator) {
      case 'eq':
        query = query.eq(field, value);
        break;
      case 'neq':
        query = query.neq(field, value);
        break;
      case 'gt':
        query = query.gt(field, value);
        break;
      case 'gte':
        query = query.gte(field, value);
        break;
      case 'lt':
        query = query.lt(field, value);
        break;
      case 'lte':
        query = query.lte(field, value);
        break;
      case 'in':
        if (Array.isArray(value)) {
          query = query.in(field, value);
        }
        break;
      case 'nin':
        if (Array.isArray(value)) {
          // Supabase doesn't have nin directly, use not.in
          query = query.not(field, 'in', `(${value.join(',')})`);
        }
        break;
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          query = query.gte(field, value[0]).lte(field, value[1]);
        }
        break;
      case 'contains':
        query = query.ilike(field, `%${value}%`);
        break;
      case 'not_contains':
        query = query.not(field, 'ilike', `%${value}%`);
        break;
      case 'is_null':
        query = query.is(field, null);
        break;
      case 'is_not_null':
        query = query.not(field, 'is', null);
        break;
    }
  }

  // Limit results
  query = query.limit(limit);

  const { data: rawDonors, error } = await query;

  if (error) {
    console.error('Segment query error:', error);
    throw error;
  }

  const now = Date.now();
  
  // Transform to SegmentDonor format and apply client-side filters
  let donors: SegmentDonor[] = (rawDonors || []).map((d: any) => {
    const ltvPrediction = d.donor_ltv_predictions?.[0] || d.donor_ltv_predictions || {};
    const daysSince = d.last_donation_date 
      ? Math.floor((now - new Date(d.last_donation_date).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    return {
      id: d.id,
      donor_key: d.donor_key,
      email: d.email,
      name: d.full_name,
      state: d.state,
      city: d.city,
      zip: d.zip,
      total_donated: d.total_donated || 0,
      donation_count: d.donation_count || 0,
      first_donation_date: d.first_donation_date,
      last_donation_date: d.last_donation_date,
      is_recurring: d.is_recurring || false,
      employer: d.employer,
      occupation: d.occupation,
      segment: ltvPrediction.segment || null,
      churn_risk_label: ltvPrediction.churn_risk_label || null,
      predicted_ltv_90: ltvPrediction.predicted_ltv_90 || null,
      predicted_ltv_180: ltvPrediction.predicted_ltv_180 || null,
      days_since_donation: daysSince,
      is_multi_channel: false, // TODO: implement multi-channel detection
    };
  });

  // Apply client-side filters for computed/joined fields
  for (const filter of filters) {
    const { field, operator, value } = filter;
    
    donors = donors.filter(donor => {
      let fieldValue: any;
      
      // Map field to donor property
      switch (field) {
        case 'days_since_donation':
          fieldValue = donor.days_since_donation;
          break;
        case 'avg_donation':
          fieldValue = donor.donation_count > 0 ? donor.total_donated / donor.donation_count : 0;
          break;
        case 'donor_tier':
          fieldValue = donor.total_donated >= 1000 ? 'major' 
            : donor.total_donated >= 250 ? 'mid' 
            : 'grassroots';
          break;
        case 'segment':
          fieldValue = donor.segment;
          break;
        case 'churn_risk_label':
          fieldValue = donor.churn_risk_label;
          break;
        case 'predicted_ltv_90':
          fieldValue = donor.predicted_ltv_90;
          break;
        case 'predicted_ltv_180':
          fieldValue = donor.predicted_ltv_180;
          break;
        default:
          return true; // Already filtered server-side
      }

      // Apply operator
      switch (operator) {
        case 'eq':
          return fieldValue === value;
        case 'neq':
          return fieldValue !== value;
        case 'gt':
          return typeof fieldValue === 'number' && fieldValue > (value as number);
        case 'gte':
          return typeof fieldValue === 'number' && fieldValue >= (value as number);
        case 'lt':
          return typeof fieldValue === 'number' && fieldValue < (value as number);
        case 'lte':
          return typeof fieldValue === 'number' && fieldValue <= (value as number);
        case 'in':
          return Array.isArray(value) && (value as string[]).includes(fieldValue);
        case 'nin':
          return Array.isArray(value) && !(value as string[]).includes(fieldValue);
        case 'between':
          if (Array.isArray(value) && value.length === 2 && typeof fieldValue === 'number') {
            const [minVal, maxVal] = value as [number, number];
            return fieldValue >= minVal && fieldValue <= maxVal;
          }
          return true;
        default:
          return true;
      }
    });
  }

  // Calculate aggregates
  const aggregates = calculateAggregates(donors);

  return {
    donors,
    aggregates,
    totalCount: donors.length,
  };
}

function calculateAggregates(donors: SegmentDonor[]): SegmentAggregates {
  if (donors.length === 0) {
    return {
      totalDonors: 0,
      totalLifetimeValue: 0,
      avgDonation: 0,
      avgDonationCount: 0,
      recurringDonors: 0,
      recurringRate: 0,
      avgDaysSinceDonation: 0,
      byState: [],
      bySegment: [],
      byChurnRisk: [],
      byTier: [],
    };
  }

  const totalDonors = donors.length;
  const totalLifetimeValue = donors.reduce((sum, d) => sum + d.total_donated, 0);
  const totalDonations = donors.reduce((sum, d) => sum + d.donation_count, 0);
  const recurringDonors = donors.filter(d => d.is_recurring).length;
  const totalDaysSince = donors.reduce((sum, d) => sum + (d.days_since_donation || 0), 0);

  // State distribution
  const stateMap = new Map<string, number>();
  donors.forEach(d => {
    if (d.state) {
      stateMap.set(d.state, (stateMap.get(d.state) || 0) + 1);
    }
  });
  const byState = Array.from(stateMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Segment distribution
  const segmentMap = new Map<string, number>();
  donors.forEach(d => {
    const seg = d.segment || 'Unknown';
    segmentMap.set(seg, (segmentMap.get(seg) || 0) + 1);
  });
  const bySegment = Array.from(segmentMap.entries())
    .map(([name, value]) => ({ 
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
      value 
    }))
    .sort((a, b) => b.value - a.value);

  // Churn risk distribution
  const riskMap = new Map<string, number>();
  donors.forEach(d => {
    const risk = d.churn_risk_label || 'Unknown';
    riskMap.set(risk, (riskMap.get(risk) || 0) + 1);
  });
  const byChurnRisk = Array.from(riskMap.entries())
    .map(([name, value]) => ({ 
      name: name.charAt(0).toUpperCase() + name.slice(1) + ' Risk', 
      value 
    }))
    .sort((a, b) => {
      const order = ['Low Risk', 'Medium Risk', 'High Risk', 'Unknown Risk'];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });

  // Tier distribution
  const tierMap = new Map<string, number>();
  donors.forEach(d => {
    const tier = d.total_donated >= 1000 ? 'Major ($1,000+)' 
      : d.total_donated >= 250 ? 'Mid-Level ($250-999)' 
      : 'Grassroots (<$250)';
    tierMap.set(tier, (tierMap.get(tier) || 0) + 1);
  });
  const byTier = Array.from(tierMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalDonors,
    totalLifetimeValue,
    avgDonation: totalDonations > 0 ? totalLifetimeValue / totalDonations : 0,
    avgDonationCount: totalDonors > 0 ? totalDonations / totalDonors : 0,
    recurringDonors,
    recurringRate: totalDonors > 0 ? (recurringDonors / totalDonors) * 100 : 0,
    avgDaysSinceDonation: totalDonors > 0 ? totalDaysSince / totalDonors : 0,
    byState,
    bySegment,
    byChurnRisk,
    byTier,
  };
}

// Hook for querying donor segments
export function useDonorSegmentQuery(
  organizationId: string,
  filters: FilterCondition[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: [SEGMENT_QUERY_KEY, organizationId, filters],
    queryFn: () => fetchSegmentDonors(organizationId, filters),
    enabled: enabled && !!organizationId,
    staleTime: 2 * 60 * 1000,
  });
}

// Fetch saved segments for an organization
async function fetchSavedSegments(organizationId: string): Promise<SavedSegment[]> {
  const { data, error } = await supabase
    .from('saved_donor_segments')
    .select('*')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved segments:', error);
    throw error;
  }

  return (data || []).map(d => ({
    id: d.id,
    organization_id: d.organization_id,
    name: d.name,
    description: d.description,
    filters: (d.filters as unknown as FilterCondition[]) || [],
    donor_count_snapshot: d.donor_count_snapshot,
    total_value_snapshot: d.total_value_snapshot,
    created_by: d.created_by,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
}

export function useSavedSegmentsQuery(organizationId: string) {
  return useQuery({
    queryKey: [SAVED_SEGMENTS_KEY, organizationId],
    queryFn: () => fetchSavedSegments(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

// Mutation for saving a segment
export function useSaveSegmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      name: string;
      description?: string;
      filters: FilterCondition[];
      donorCount: number;
      totalValue: number;
    }) => {
      const { data, error } = await supabase
        .from('saved_donor_segments')
        .insert({
          organization_id: params.organizationId,
          name: params.name,
          description: params.description || null,
          filters: params.filters as any,
          donor_count_snapshot: params.donorCount,
          total_value_snapshot: params.totalValue,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [SAVED_SEGMENTS_KEY, variables.organizationId] 
      });
    },
  });
}

// Mutation for deleting a segment
export function useDeleteSegmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { segmentId: string; organizationId: string }) => {
      const { error } = await supabase
        .from('saved_donor_segments')
        .delete()
        .eq('id', params.segmentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [SAVED_SEGMENTS_KEY, variables.organizationId] 
      });
    },
  });
}

// Export donors to CSV
export function exportDonorsToCSV(donors: SegmentDonor[], filename: string = 'donor-segment.csv') {
  const headers = [
    'Name',
    'Email',
    'State',
    'City',
    'Zip',
    'Total Donated',
    'Donation Count',
    'First Donation',
    'Last Donation',
    'Is Recurring',
    'Employer',
    'Occupation',
    'RFM Segment',
    'Churn Risk',
    'Predicted LTV (90d)',
  ];

  const rows = donors.map(d => [
    d.name || '',
    d.email || '',
    d.state || '',
    d.city || '',
    d.zip || '',
    d.total_donated.toFixed(2),
    d.donation_count.toString(),
    d.first_donation_date || '',
    d.last_donation_date || '',
    d.is_recurring ? 'Yes' : 'No',
    d.employer || '',
    d.occupation || '',
    d.segment || '',
    d.churn_risk_label || '',
    d.predicted_ltv_90?.toFixed(2) || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
