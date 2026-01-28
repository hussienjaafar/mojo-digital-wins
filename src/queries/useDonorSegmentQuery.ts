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

// Map filter fields to actual database column names
const FIELD_MAPPING: Record<string, string> = {
  'email': 'donor_email',
  'name': 'first_name',
  'total_donated': 'total_donated',
  'total_lifetime_value': 'total_donated',
  'donation_count': 'donation_count',
  'state': 'state',
  'city': 'city',
  'is_recurring': 'is_recurring',
  'is_recurring_donor': 'is_recurring',
  'employer': 'employer',
  'occupation': 'occupation',
  'first_donation_date': 'first_donation_date',
  'last_donation_date': 'last_donation_date',
};

// Fields that require client-side filtering
const CLIENT_SIDE_FIELDS = [
  'segment', 'churn_risk_label', 'predicted_ltv_90', 'predicted_ltv_180',
  'days_since_donation', 'avg_donation', 'rfm_score', 'recency_score',
  'frequency_score', 'monetary_score', 'donor_tier', 'attributed_channel',
  'attributed_topic', 'attributed_pain_point', 'attributed_value'
];

// Apply a single filter to the Supabase query
function applyServerFilter(query: any, filter: FilterCondition): any {
  const { field, operator, value } = filter;
  
  // Skip client-side fields
  if (CLIENT_SIDE_FIELDS.includes(field)) {
    return query;
  }

  const dbField = FIELD_MAPPING[field] || field;

  switch (operator) {
    case 'eq':
      return query.eq(dbField, value);
    case 'neq':
      return query.neq(dbField, value);
    case 'gt':
      return query.gt(dbField, value);
    case 'gte':
      return query.gte(dbField, value);
    case 'lt':
      return query.lt(dbField, value);
    case 'lte':
      return query.lte(dbField, value);
    case 'in':
      return query.in(dbField, Array.isArray(value) ? value : [value]);
    case 'nin':
      if (Array.isArray(value)) {
        return query.not(dbField, 'in', `(${value.join(',')})`);
      }
      return query;
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return query.gte(dbField, value[0]).lte(dbField, value[1]);
      }
      return query;
    case 'contains':
      return query.ilike(dbField, `%${value}%`);
    case 'not_contains':
      return query.not(dbField, 'ilike', `%${value}%`);
    case 'is_null':
      return query.is(dbField, null);
    case 'is_not_null':
      return query.not(dbField, 'is', null);
    default:
      return query;
  }
}

// Apply client-side filter for computed/LTV fields
function applyClientFilter(donor: SegmentDonor, filter: FilterCondition): boolean {
  const { field, operator, value } = filter;
  
  // Skip fields handled server-side
  if (!CLIENT_SIDE_FIELDS.includes(field)) {
    return true;
  }

  let fieldValue: any;
  
  switch (field) {
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
    case 'days_since_donation':
      fieldValue = donor.days_since_donation;
      break;
    case 'avg_donation':
      fieldValue = donor.donation_count > 0 ? donor.total_donated / donor.donation_count : 0;
      break;
    case 'donor_tier': {
      // Return array of ALL matching tiers for this donor
      const tiers: string[] = [];
      const total = donor.total_donated;
      const count = donor.donation_count;
      const daysSince = donor.days_since_donation;
      
      // Monetary tiers (mutually exclusive)
      if (total >= 1000) tiers.push('major');
      else if (total >= 250) tiers.push('mid');
      else tiers.push('grassroots');
      
      // Engagement tiers (can stack)
      if (count >= 5) tiers.push('repeat');
      if (count === 1) tiers.push('one_time');
      if (daysSince <= 90) tiers.push('active');
      else if (daysSince <= 180) tiers.push('lapsing');
      else tiers.push('lapsed');
      
      fieldValue = tiers;
      break;
    }
    case 'attributed_channel':
      // This will be enriched from attribution data later
      fieldValue = (donor as any).attributed_channels || [];
      break;
    case 'attributed_topic':
      fieldValue = (donor as any).attributed_topics || [];
      break;
    case 'attributed_pain_point':
      fieldValue = ((donor as any).attributed_pain_points || []).join(' ');
      break;
    case 'attributed_value':
      fieldValue = (donor as any).attributed_values || [];
      break;
    default:
      return true;
  }

  // Handle null comparisons
  if (operator === 'is_null') return fieldValue === null || fieldValue === undefined;
  if (operator === 'is_not_null') return fieldValue !== null && fieldValue !== undefined;
  if (fieldValue === null || fieldValue === undefined) return false;

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
      // Handle array fieldValue (like donor_tier which returns multiple tiers)
      if (Array.isArray(fieldValue)) {
        return Array.isArray(value) && (value as string[]).some(v => fieldValue.includes(v));
      }
      return Array.isArray(value) && (value as (string | number)[]).includes(fieldValue);
    case 'nin':
      // Handle array fieldValue
      if (Array.isArray(fieldValue)) {
        return Array.isArray(value) && !(value as string[]).some(v => fieldValue.includes(v));
      }
      return Array.isArray(value) && !(value as (string | number)[]).includes(fieldValue);
    case 'between':
      if (Array.isArray(value) && value.length === 2 && typeof fieldValue === 'number') {
        const [minVal, maxVal] = value as [number, number];
        return fieldValue >= minVal && fieldValue <= maxVal;
      }
      return true;
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
    default:
      return true;
  }
}

// Attribution data structure for donors
interface DonorAttribution {
  channels: string[];
  topics: string[];
  painPoints: string[];
  values: string[];
  issues: string[];
  emotions: string[];
}

// Transform raw database row to SegmentDonor
function transformToDonor(
  row: any, 
  ltvData: any,
  attribution?: DonorAttribution
): SegmentDonor {
  const now = Date.now();
  const daysSince = row.last_donation_date 
    ? Math.floor((now - new Date(row.last_donation_date).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  return {
    id: row.id,
    donor_key: row.donor_key,
    email: row.donor_email,
    phone: row.phone || null,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
    state: row.state,
    city: row.city,
    zip: row.zip,
    total_donated: row.total_donated || 0,
    donation_count: row.donation_count || 0,
    first_donation_date: row.first_donation_date,
    last_donation_date: row.last_donation_date,
    is_recurring: row.is_recurring || false,
    employer: row.employer,
    occupation: row.occupation,
    segment: ltvData?.segment || null,
    churn_risk_label: ltvData?.churn_risk_label || null,
    predicted_ltv_90: ltvData?.predicted_ltv_90 || null,
    predicted_ltv_180: ltvData?.predicted_ltv_180 || null,
    days_since_donation: daysSince,
    is_multi_channel: (attribution?.channels?.length || 0) > 1,
    attributed_channels: attribution?.channels || [],
    attributed_topics: attribution?.topics || [],
    attributed_pain_points: attribution?.painPoints || [],
    attributed_values: attribution?.values || [],
    attributed_issues: attribution?.issues || [],
    attributed_emotions: attribution?.emotions || [],
  };
}

// Fetch all records with pagination to bypass Supabase 1000 row limit
async function fetchAllWithPagination(
  baseQuery: any,
  batchSize: number = 1000
): Promise<any[]> {
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await baseQuery.range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Pagination fetch error:', error);
      throw error;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      hasMore = data.length === batchSize;
      from += batchSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// Main fetch function with two-query strategy and pagination
async function fetchSegmentDonors(
  organizationId: string,
  filters: FilterCondition[]
): Promise<SegmentQueryResult> {
  // Step 1: Build demographics query with correct column names
  let query = supabase
    .from('donor_demographics')
    .select(`
      id,
      donor_key,
      donor_email,
      phone,
      first_name,
      last_name,
      state,
      city,
      zip,
      total_donated,
      donation_count,
      first_donation_date,
      last_donation_date,
      is_recurring,
      employer,
      occupation
    `)
    .eq('organization_id', organizationId)
    .order('total_donated', { ascending: false, nullsFirst: false });

  // Apply server-side filters
  for (const filter of filters) {
    query = applyServerFilter(query, filter);
  }

  // Fetch ALL records using pagination
  const demographics = await fetchAllWithPagination(query);

  if (!demographics || demographics.length === 0) {
    return { 
      donors: [], 
      aggregates: calculateAggregates([]), 
      totalCount: 0 
    };
  }

  // Step 2: Get LTV predictions for matched donors
  const donorKeys = demographics
    .map(d => d.donor_key)
    .filter((k): k is string => k !== null && k !== undefined);

  let ltvMap = new Map<string, any>();

  if (donorKeys.length > 0) {
    // Batch in chunks of 1000 to avoid query limits
    const chunks = [];
    for (let i = 0; i < donorKeys.length; i += 1000) {
      chunks.push(donorKeys.slice(i, i + 1000));
    }

    const ltvResults = await Promise.all(
      chunks.map(chunk => 
        supabase
          .from('donor_ltv_predictions')
          .select('donor_key, segment, churn_risk_label, predicted_ltv_90, predicted_ltv_180')
          .eq('organization_id', organizationId)
          .in('donor_key', chunk)
      )
    );

    for (const result of ltvResults) {
      if (result.data) {
        for (const ltv of result.data) {
          ltvMap.set(ltv.donor_key, ltv);
        }
      }
    }
  }

  // Step 3: Fetch attribution data (channel + motivation per donor)
  const donorEmails = demographics
    .map(d => d.donor_email?.toLowerCase().trim())
    .filter((e): e is string => !!e);

  const attributionMap = new Map<string, DonorAttribution>();

  if (donorEmails.length > 0) {
    // Get transactions with refcodes for these donors
    const emailChunks = [];
    for (let i = 0; i < donorEmails.length; i += 500) {
      emailChunks.push(donorEmails.slice(i, i + 500));
    }

    // Fetch in parallel: transactions, refcode mappings, and creative insights
    const [txResults, refcodeResult, creativeResult, smsResult] = await Promise.all([
      Promise.all(emailChunks.map(chunk =>
        supabase
          .from('actblue_transactions')
          .select('donor_email, refcode')
          .eq('organization_id', organizationId)
          .in('donor_email', chunk)
          .not('refcode', 'is', null)
      )),
      supabase
        .from('refcode_mappings')
        .select('refcode, platform, creative_id, campaign_id')
        .eq('organization_id', organizationId),
      supabase
        .from('meta_creative_insights')
        .select('creative_id, topic, donor_pain_points, values_appealed, issue_specifics, emotional_triggers')
        .eq('organization_id', organizationId),
      supabase
        .from('sms_campaigns')
        .select('id, topic, donor_pain_points, values_appealed, issue_specifics, emotional_triggers')
        .eq('organization_id', organizationId)
    ]);

    // Build lookup maps
    const refcodeMap = new Map(
      refcodeResult.data?.map(r => [r.refcode, r]) || []
    );
    const creativeMap = new Map(
      creativeResult.data?.map(c => [c.creative_id, c]) || []
    );
    const smsMap = new Map(
      smsResult.data?.map(s => [s.id, s]) || []
    );

    // Aggregate attribution per donor
    for (const txResult of txResults) {
      if (!txResult.data) continue;
      for (const tx of txResult.data) {
        const email = tx.donor_email?.toLowerCase().trim();
        if (!email || !tx.refcode) continue;

        if (!attributionMap.has(email)) {
          attributionMap.set(email, {
            channels: [],
            topics: [],
            painPoints: [],
            values: [],
            issues: [],
            emotions: [],
          });
        }

        const attr = attributionMap.get(email)!;
        const refData = refcodeMap.get(tx.refcode);

        if (refData?.platform && !attr.channels.includes(refData.platform)) {
          attr.channels.push(refData.platform);
        }

        // Get motivation data from creative or SMS
        const creative = refData?.creative_id ? creativeMap.get(refData.creative_id) : null;
        const sms = refData?.campaign_id ? smsMap.get(refData.campaign_id) : null;
        const source = creative || sms;

        if (source) {
          if (source.topic && !attr.topics.includes(source.topic)) {
            attr.topics.push(source.topic);
          }
          (source.donor_pain_points || []).forEach((p: string) => {
            if (!attr.painPoints.includes(p)) attr.painPoints.push(p);
          });
          (source.values_appealed || []).forEach((v: string) => {
            if (!attr.values.includes(v)) attr.values.push(v);
          });
          (source.issue_specifics || []).forEach((i: string) => {
            if (!attr.issues.includes(i)) attr.issues.push(i);
          });
          (source.emotional_triggers || []).forEach((e: string) => {
            if (!attr.emotions.includes(e)) attr.emotions.push(e);
          });
        }
      }
    }
  }

  // Step 4: Transform and enrich donors with attribution
  let donors = demographics.map(row => {
    const email = row.donor_email?.toLowerCase().trim();
    const attribution = email ? attributionMap.get(email) : undefined;
    return transformToDonor(row, ltvMap.get(row.donor_key || ''), attribution);
  });

  // Step 5: Apply client-side filters
  const clientFilters = filters.filter(f => CLIENT_SIDE_FIELDS.includes(f.field));
  if (clientFilters.length > 0) {
    donors = donors.filter(donor => 
      clientFilters.every(filter => applyClientFilter(donor, filter))
    );
  }

  // Step 6: Calculate aggregates
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
      byChannel: [],
      byTopic: [],
      byPainPoint: [],
      byValue: [],
      byEmotion: [],
    };
  }

  const totalDonors = donors.length;
  const totalLifetimeValue = donors.reduce((sum, d) => sum + d.total_donated, 0);
  const totalDonations = donors.reduce((sum, d) => sum + d.donation_count, 0);
  const recurringDonors = donors.filter(d => d.is_recurring).length;
  const totalDaysSince = donors.reduce((sum, d) => sum + (d.days_since_donation || 0), 0);

  // State distribution (top 10)
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

  // Channel distribution (from attributed_channels)
  const channelMap = new Map<string, number>();
  donors.forEach(d => {
    const channels = d.attributed_channels || [];
    if (channels.length > 0) {
      channels.forEach(ch => {
        const channelLabel = ch === 'meta' ? 'Meta Ads' 
          : ch === 'sms' ? 'SMS' 
          : ch === 'email' ? 'Email' 
          : ch === 'direct' ? 'Direct' 
          : ch;
        channelMap.set(channelLabel, (channelMap.get(channelLabel) || 0) + 1);
      });
    } else {
      channelMap.set('Unknown', (channelMap.get('Unknown') || 0) + 1);
    }
  });
  const byChannel = Array.from(channelMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Topic distribution from AI-analyzed content
  const topicMap = new Map<string, number>();
  donors.forEach(d => {
    const topics = d.attributed_topics || [];
    topics.forEach(t => {
      const label = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      topicMap.set(label, (topicMap.get(label) || 0) + 1);
    });
  });
  const byTopic = Array.from(topicMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Pain point distribution
  const painPointMap = new Map<string, number>();
  donors.forEach(d => {
    const painPoints = d.attributed_pain_points || [];
    painPoints.forEach(p => {
      // Truncate long pain points for display
      const label = p.length > 50 ? p.slice(0, 47) + '...' : p;
      painPointMap.set(label, (painPointMap.get(label) || 0) + 1);
    });
  });
  const byPainPoint = Array.from(painPointMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Values distribution
  const valueMap = new Map<string, number>();
  donors.forEach(d => {
    const values = d.attributed_values || [];
    values.forEach(v => {
      const label = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
      valueMap.set(label, (valueMap.get(label) || 0) + 1);
    });
  });
  const byValue = Array.from(valueMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Emotion distribution
  const emotionMap = new Map<string, number>();
  donors.forEach(d => {
    const emotions = d.attributed_emotions || [];
    emotions.forEach(e => {
      const label = e.charAt(0).toUpperCase() + e.slice(1).toLowerCase();
      emotionMap.set(label, (emotionMap.get(label) || 0) + 1);
    });
  });
  const byEmotion = Array.from(emotionMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

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
    byChannel,
    byTopic,
    byPainPoint,
    byValue,
    byEmotion,
  };
}

// Hook for querying donor segments
export function useDonorSegmentQuery(
  organizationId: string,
  filters: FilterCondition[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: [SEGMENT_QUERY_KEY, organizationId, JSON.stringify(filters)],
    queryFn: () => fetchSegmentDonors(organizationId, filters),
    enabled: enabled && !!organizationId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
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
