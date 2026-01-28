// Types for the Donor Segment Builder

export type FilterOperator = 
  | 'eq' | 'neq' 
  | 'gt' | 'gte' 
  | 'lt' | 'lte' 
  | 'in' | 'nin'
  | 'between'
  | 'contains' | 'not_contains'
  | 'is_null' | 'is_not_null';

export type FilterFieldType = 
  | 'number' 
  | 'currency' 
  | 'boolean' 
  | 'string' 
  | 'date' 
  | 'select' 
  | 'multi-select';

export interface FilterField {
  key: string;
  label: string;
  category: string;
  type: FilterFieldType;
  operators: FilterOperator[];
  options?: { value: string; label: string }[];
  description?: string;
}

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | number[] | [number, number] | null;
}

export interface SavedSegment {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  filters: FilterCondition[];
  donor_count_snapshot: number | null;
  total_value_snapshot: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SegmentDonor {
  id: string;
  donor_key: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  state: string | null;
  city: string | null;
  zip: string | null;
  total_donated: number;
  donation_count: number;
  first_donation_date: string | null;
  last_donation_date: string | null;
  is_recurring: boolean;
  employer: string | null;
  occupation: string | null;
  // From LTV predictions
  segment: string | null;
  churn_risk_label: string | null;
  predicted_ltv_90: number | null;
  predicted_ltv_180: number | null;
  // Computed
  days_since_donation: number;
  is_multi_channel: boolean;
  // Attribution data
  attributed_channels: string[];
  attributed_topics: string[];
  // Deep motivation attribution
  attributed_pain_points: string[];
  attributed_values: string[];
  attributed_issues: string[];
  attributed_emotions: string[];
}

export interface SegmentAggregates {
  totalDonors: number;
  totalLifetimeValue: number;
  avgDonation: number;
  avgDonationCount: number;
  recurringDonors: number;
  recurringRate: number;
  avgDaysSinceDonation: number;
  // Distribution breakdowns
  byState: { name: string; value: number }[];
  bySegment: { name: string; value: number }[];
  byChurnRisk: { name: string; value: number }[];
  byTier: { name: string; value: number }[];
  byChannel: { name: string; value: number }[];
  // Deep motivation breakdowns
  byTopic: { name: string; value: number }[];
  byPainPoint: { name: string; value: number }[];
  byValue: { name: string; value: number }[];
  byEmotion: { name: string; value: number }[];
}

// Available filter fields for the segment builder
export const SEGMENT_FILTER_FIELDS: FilterField[] = [
  // Giving behavior
  {
    key: 'total_donated',
    label: 'Lifetime Donation Total',
    category: 'Giving Behavior',
    type: 'currency',
    operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'],
    description: 'Total amount donated across all transactions',
  },
  {
    key: 'donation_count',
    label: 'Number of Donations',
    category: 'Giving Behavior',
    type: 'number',
    operators: ['gt', 'gte', 'lt', 'lte', 'eq', 'between'],
    description: 'Total number of donations made',
  },
  {
    key: 'is_recurring',
    label: 'Recurring Donor',
    category: 'Giving Behavior',
    type: 'boolean',
    operators: ['eq'],
    description: 'Whether donor has an active recurring donation',
  },
  {
    key: 'avg_donation',
    label: 'Average Donation',
    category: 'Giving Behavior',
    type: 'currency',
    operators: ['gt', 'gte', 'lt', 'lte', 'between'],
    description: 'Average donation amount',
  },
  // Recency
  {
    key: 'days_since_donation',
    label: 'Days Since Last Donation',
    category: 'Recency',
    type: 'number',
    operators: ['gt', 'gte', 'lt', 'lte', 'between'],
    description: 'Number of days since their last donation',
  },
  {
    key: 'first_donation_date',
    label: 'First Donation Date',
    category: 'Recency',
    type: 'date',
    operators: ['gt', 'gte', 'lt', 'lte', 'between'],
    description: 'Date of their first donation',
  },
  {
    key: 'last_donation_date',
    label: 'Last Donation Date',
    category: 'Recency',
    type: 'date',
    operators: ['gt', 'gte', 'lt', 'lte', 'between'],
    description: 'Date of their most recent donation',
  },
  // RFM Segment
  {
    key: 'segment',
    label: 'RFM Segment',
    category: 'RFM Analysis',
    type: 'multi-select',
    operators: ['in', 'nin'],
    options: [
      { value: 'champion', label: 'Champion' },
      { value: 'loyal', label: 'Loyal' },
      { value: 'potential_loyalist', label: 'Potential Loyalist' },
      { value: 'new_donor', label: 'New Donor' },
      { value: 'promising', label: 'Promising' },
      { value: 'needs_attention', label: 'Needs Attention' },
      { value: 'about_to_sleep', label: 'About to Sleep' },
      { value: 'at_risk', label: 'At Risk' },
      { value: 'hibernating', label: 'Hibernating' },
      { value: 'lost', label: 'Lost' },
    ],
    description: 'RFM-based donor classification',
  },
  {
    key: 'churn_risk_label',
    label: 'Churn Risk',
    category: 'RFM Analysis',
    type: 'multi-select',
    operators: ['in', 'nin'],
    options: [
      { value: 'low', label: 'Low Risk' },
      { value: 'medium', label: 'Medium Risk' },
      { value: 'high', label: 'High Risk' },
    ],
    description: 'Predicted likelihood of donor lapsing',
  },
  {
    key: 'predicted_ltv_90',
    label: 'Predicted LTV (90-day)',
    category: 'RFM Analysis',
    type: 'currency',
    operators: ['gt', 'gte', 'lt', 'lte', 'between'],
    description: 'Predicted value over next 90 days',
  },
  // Geography
  {
    key: 'state',
    label: 'State',
    category: 'Geography',
    type: 'multi-select',
    operators: ['in', 'nin'],
    options: [
      { value: 'AL', label: 'Alabama' },
      { value: 'AK', label: 'Alaska' },
      { value: 'AZ', label: 'Arizona' },
      { value: 'AR', label: 'Arkansas' },
      { value: 'CA', label: 'California' },
      { value: 'CO', label: 'Colorado' },
      { value: 'CT', label: 'Connecticut' },
      { value: 'DE', label: 'Delaware' },
      { value: 'DC', label: 'District of Columbia' },
      { value: 'FL', label: 'Florida' },
      { value: 'GA', label: 'Georgia' },
      { value: 'HI', label: 'Hawaii' },
      { value: 'ID', label: 'Idaho' },
      { value: 'IL', label: 'Illinois' },
      { value: 'IN', label: 'Indiana' },
      { value: 'IA', label: 'Iowa' },
      { value: 'KS', label: 'Kansas' },
      { value: 'KY', label: 'Kentucky' },
      { value: 'LA', label: 'Louisiana' },
      { value: 'ME', label: 'Maine' },
      { value: 'MD', label: 'Maryland' },
      { value: 'MA', label: 'Massachusetts' },
      { value: 'MI', label: 'Michigan' },
      { value: 'MN', label: 'Minnesota' },
      { value: 'MS', label: 'Mississippi' },
      { value: 'MO', label: 'Missouri' },
      { value: 'MT', label: 'Montana' },
      { value: 'NE', label: 'Nebraska' },
      { value: 'NV', label: 'Nevada' },
      { value: 'NH', label: 'New Hampshire' },
      { value: 'NJ', label: 'New Jersey' },
      { value: 'NM', label: 'New Mexico' },
      { value: 'NY', label: 'New York' },
      { value: 'NC', label: 'North Carolina' },
      { value: 'ND', label: 'North Dakota' },
      { value: 'OH', label: 'Ohio' },
      { value: 'OK', label: 'Oklahoma' },
      { value: 'OR', label: 'Oregon' },
      { value: 'PA', label: 'Pennsylvania' },
      { value: 'RI', label: 'Rhode Island' },
      { value: 'SC', label: 'South Carolina' },
      { value: 'SD', label: 'South Dakota' },
      { value: 'TN', label: 'Tennessee' },
      { value: 'TX', label: 'Texas' },
      { value: 'UT', label: 'Utah' },
      { value: 'VT', label: 'Vermont' },
      { value: 'VA', label: 'Virginia' },
      { value: 'WA', label: 'Washington' },
      { value: 'WV', label: 'West Virginia' },
      { value: 'WI', label: 'Wisconsin' },
      { value: 'WY', label: 'Wyoming' },
    ],
    description: 'Donor state/territory',
  },
  {
    key: 'city',
    label: 'City',
    category: 'Geography',
    type: 'string',
    operators: ['contains', 'eq'],
    description: 'Donor city (text search)',
  },
  // Demographics
  {
    key: 'employer',
    label: 'Employer',
    category: 'Demographics',
    type: 'string',
    operators: ['contains', 'eq', 'is_null', 'is_not_null'],
    description: 'Donor employer',
  },
  {
    key: 'occupation',
    label: 'Occupation',
    category: 'Demographics',
    type: 'string',
    operators: ['contains', 'eq', 'is_null', 'is_not_null'],
    description: 'Donor occupation',
  },
  // Tier classification
  {
    key: 'donor_tier',
    label: 'Donor Tier',
    category: 'Classification',
    type: 'multi-select',
    operators: ['in', 'nin'],
    options: [
      // Monetary-based tiers
      { value: 'major', label: 'Major ($1,000+)' },
      { value: 'mid', label: 'Mid-Level ($250-999)' },
      { value: 'grassroots', label: 'Grassroots (<$250)' },
      // Engagement-based tiers
      { value: 'repeat', label: 'Repeat (5+ donations)' },
      { value: 'active', label: 'Active (donated in 90 days)' },
      { value: 'lapsing', label: 'Lapsing (90-180 days ago)' },
      { value: 'lapsed', label: 'Lapsed (180+ days ago)' },
      { value: 'one_time', label: 'One-Time Donor' },
    ],
    description: 'Donor tier based on giving level and engagement',
  },
  // Attribution-based classification
  {
    key: 'attributed_channel',
    label: 'Donation Channel',
    category: 'Attribution',
    type: 'multi-select',
    operators: ['in', 'nin'],
    options: [
      { value: 'meta', label: 'Meta Ads' },
      { value: 'sms', label: 'SMS' },
      { value: 'email', label: 'Email' },
      { value: 'direct', label: 'Direct/Organic' },
    ],
    description: 'Marketing channel that drove the donation',
  },
  {
    key: 'attributed_topic',
    label: 'Acquisition Topic',
    category: 'Attribution',
    type: 'multi-select',
    operators: ['in', 'nin'],
    options: [
      { value: 'foreign policy', label: 'Foreign Policy' },
      { value: 'healthcare', label: 'Healthcare' },
      { value: 'economy', label: 'Economy' },
      { value: 'elections', label: 'Elections' },
      { value: 'civil rights', label: 'Civil Rights' },
      { value: 'immigration', label: 'Immigration' },
      { value: 'environment', label: 'Environment' },
      { value: 'education', label: 'Education' },
      { value: 'fundraising', label: 'Fundraising' },
    ],
    description: 'AI-analyzed topic from the ad/SMS that acquired this donor',
  },
  {
    key: 'attributed_pain_point',
    label: 'Motivation Pain Point',
    category: 'Attribution',
    type: 'string',
    operators: ['contains', 'not_contains'],
    description: 'Specific pain point that motivated the donation (e.g., "AIPAC influence")',
  },
  {
    key: 'attributed_value',
    label: 'Motivation Value',
    category: 'Attribution',
    type: 'multi-select',
    operators: ['in', 'nin'],
    options: [
      { value: 'justice', label: 'Justice' },
      { value: 'community empowerment', label: 'Community Empowerment' },
      { value: 'anti-establishment', label: 'Anti-Establishment' },
      { value: 'solidarity', label: 'Solidarity' },
      { value: 'representation', label: 'Representation' },
      { value: 'protecting vulnerable', label: 'Protecting Vulnerable' },
      { value: 'patriotism', label: 'Patriotism' },
    ],
    description: 'Core value that motivated the donation',
  },
];

// Operator display labels
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'equals',
  neq: 'does not equal',
  gt: 'greater than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  in: 'is any of',
  nin: 'is not any of',
  between: 'is between',
  contains: 'contains',
  not_contains: 'does not contain',
  is_null: 'is empty',
  is_not_null: 'has a value',
};
