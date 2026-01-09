import { OrganizationType, OrgProfileData, GeoLevel } from './types';

export interface OrgTypeTemplate {
  id: OrganizationType;
  label: string;
  category: string;
  description: string;
  emoji: string;
  defaults: Partial<OrgProfileData>;
  suggestedWatchlistEntities: string[];
  suggestedPolicyDomains: string[];
}

export const ORG_TYPE_TEMPLATES: OrgTypeTemplate[] = [
  // Electoral Campaigns
  {
    id: 'campaign_federal',
    label: 'Federal Campaign',
    category: 'Electoral Campaign',
    description: 'Congressional, Senate, or Presidential races',
    emoji: '🏛️',
    defaults: {
      geo_level: 'congressional_district' as GeoLevel,
      sentiment_sensitivity: 'high',
      risk_tolerance: 'low',
    },
    suggestedWatchlistEntities: ['Opponent candidates', 'Key endorsers', 'Major donors', 'Local media outlets'],
    suggestedPolicyDomains: ['Voting Rights', 'Economic Justice', 'Healthcare'],
  },
  {
    id: 'campaign_state',
    label: 'State Campaign',
    category: 'Electoral Campaign',
    description: 'Governor, State Legislature, or statewide office',
    emoji: '🏛️',
    defaults: {
      geo_level: 'state' as GeoLevel,
      sentiment_sensitivity: 'high',
      risk_tolerance: 'low',
    },
    suggestedWatchlistEntities: ['State legislators', 'Governor', 'State party chairs', 'Major state PACs'],
    suggestedPolicyDomains: ['Education', 'Healthcare', 'Labor & Workers Rights'],
  },
  {
    id: 'campaign_local',
    label: 'Local Campaign',
    category: 'Electoral Campaign',
    description: 'Mayor, City Council, County, or School Board',
    emoji: '🏘️',
    defaults: {
      geo_level: 'city' as GeoLevel,
      sentiment_sensitivity: 'medium',
      risk_tolerance: 'low',
    },
    suggestedWatchlistEntities: ['Local officials', 'Community leaders', 'Local business groups'],
    suggestedPolicyDomains: ['Housing', 'Education', 'Criminal Justice'],
  },
  
  // 501(c)(3) Nonprofits
  {
    id: 'c3_national',
    label: 'National 501(c)(3)',
    category: '501(c)(3) Nonprofit',
    description: 'National charitable or educational organization',
    emoji: '🌎',
    defaults: {
      geo_level: 'national' as GeoLevel,
      sentiment_sensitivity: 'medium',
      risk_tolerance: 'medium',
    },
    suggestedWatchlistEntities: ['Congressional leaders', 'Federal agencies', 'Major foundations', 'Peer organizations'],
    suggestedPolicyDomains: ['Civil Rights', 'Environment', 'Education'],
  },
  {
    id: 'c3_state',
    label: 'State 501(c)(3)',
    category: '501(c)(3) Nonprofit',
    description: 'State-focused charitable organization',
    emoji: '🏛️',
    defaults: {
      geo_level: 'state' as GeoLevel,
      sentiment_sensitivity: 'medium',
      risk_tolerance: 'medium',
    },
    suggestedWatchlistEntities: ['State legislators', 'State agencies', 'Major state funders'],
    suggestedPolicyDomains: ['Education', 'Healthcare', 'Environment'],
  },
  {
    id: 'c3_local',
    label: 'Local 501(c)(3)',
    category: '501(c)(3) Nonprofit',
    description: 'Community-based charitable organization',
    emoji: '🏘️',
    defaults: {
      geo_level: 'city' as GeoLevel,
      sentiment_sensitivity: 'low',
      risk_tolerance: 'medium',
    },
    suggestedWatchlistEntities: ['City council', 'Local foundations', 'Community leaders'],
    suggestedPolicyDomains: ['Housing', 'Education', 'Economic Justice'],
  },
  
  // 501(c)(4) Advocacy
  {
    id: 'c4_national',
    label: 'National 501(c)(4)',
    category: '501(c)(4) Advocacy',
    description: 'National advocacy or social welfare organization',
    emoji: '📢',
    defaults: {
      geo_level: 'national' as GeoLevel,
      sentiment_sensitivity: 'high',
      risk_tolerance: 'medium',
    },
    suggestedWatchlistEntities: ['Key legislators', 'Opposition groups', 'Allied organizations', 'Major donors'],
    suggestedPolicyDomains: ['Civil Rights', 'Environment', 'Economic Justice', 'Voting Rights'],
  },
  {
    id: 'c4_state',
    label: 'State 501(c)(4)',
    category: '501(c)(4) Advocacy',
    description: 'State-level advocacy organization',
    emoji: '📢',
    defaults: {
      geo_level: 'state' as GeoLevel,
      sentiment_sensitivity: 'high',
      risk_tolerance: 'medium',
    },
    suggestedWatchlistEntities: ['State legislators', 'Governor', 'State agencies', 'Opposition groups'],
    suggestedPolicyDomains: ['Voting Rights', 'Labor & Workers Rights', 'Healthcare'],
  },
  {
    id: 'c4_local',
    label: 'Local 501(c)(4)',
    category: '501(c)(4) Advocacy',
    description: 'Local advocacy or civic organization',
    emoji: '📢',
    defaults: {
      geo_level: 'city' as GeoLevel,
      sentiment_sensitivity: 'medium',
      risk_tolerance: 'medium',
    },
    suggestedWatchlistEntities: ['City council', 'Local officials', 'Business leaders'],
    suggestedPolicyDomains: ['Housing', 'Criminal Justice', 'Environment'],
  },
  
  // PACs
  {
    id: 'pac_federal',
    label: 'Federal PAC',
    category: 'Political Action Committee',
    description: 'Federal political action committee',
    emoji: '💰',
    defaults: {
      geo_level: 'national' as GeoLevel,
      sentiment_sensitivity: 'high',
      risk_tolerance: 'low',
    },
    suggestedWatchlistEntities: ['Supported candidates', 'Opposition candidates', 'Major donors', 'Super PACs'],
    suggestedPolicyDomains: ['Voting Rights', 'Economic Justice', 'Foreign Policy'],
  },
  {
    id: 'pac_state',
    label: 'State PAC',
    category: 'Political Action Committee',
    description: 'State political action committee',
    emoji: '💰',
    defaults: {
      geo_level: 'state' as GeoLevel,
      sentiment_sensitivity: 'high',
      risk_tolerance: 'low',
    },
    suggestedWatchlistEntities: ['Supported candidates', 'State party', 'Major state donors'],
    suggestedPolicyDomains: ['Voting Rights', 'Education', 'Healthcare'],
  },
  
  // International
  {
    id: 'international',
    label: 'International Organization',
    category: 'International',
    description: 'International NGO or global organization',
    emoji: '🌍',
    defaults: {
      geo_level: 'international' as GeoLevel,
      sentiment_sensitivity: 'medium',
      risk_tolerance: 'medium',
    },
    suggestedWatchlistEntities: ['UN agencies', 'International NGOs', 'Major foundations', 'Government agencies'],
    suggestedPolicyDomains: ['Foreign Policy', 'Environment', 'Civil Rights'],
  },
  
  // Other
  {
    id: 'other',
    label: 'Other Organization',
    category: 'Other',
    description: 'Custom organization type',
    emoji: '🏢',
    defaults: {
      geo_level: 'national' as GeoLevel,
      sentiment_sensitivity: 'medium',
      risk_tolerance: 'medium',
    },
    suggestedWatchlistEntities: [],
    suggestedPolicyDomains: [],
  },
];

export function getTemplateById(id: OrganizationType): OrgTypeTemplate | undefined {
  return ORG_TYPE_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(): Record<string, OrgTypeTemplate[]> {
  return ORG_TYPE_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, OrgTypeTemplate[]>);
}
