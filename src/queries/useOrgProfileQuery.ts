/**
 * React Query hooks for org profile and personalization data
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrgInterestTopic, OrgInterestEntity, OrgProfile, OrgAlertPreferences, OrgType } from "@/utils/orgRelevance";

// ============================================================================
// Types
// ============================================================================

export interface OrgProfileData {
  profile: OrgProfile | null;
  interestTopics: OrgInterestTopic[];
  interestEntities: OrgInterestEntity[];
  alertPreferences: OrgAlertPreferences | null;
}

// ============================================================================
// Query Keys
// ============================================================================

export const orgProfileKeys = {
  all: ['org-profile'] as const,
  profile: (orgId: string) => [...orgProfileKeys.all, 'profile', orgId] as const,
  topics: (orgId: string) => [...orgProfileKeys.all, 'topics', orgId] as const,
  entities: (orgId: string) => [...orgProfileKeys.all, 'entities', orgId] as const,
  preferences: (orgId: string) => [...orgProfileKeys.all, 'preferences', orgId] as const,
  full: (orgId: string) => [...orgProfileKeys.all, 'full', orgId] as const,
};

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchOrgProfile(organizationId: string): Promise<OrgProfileData> {
  // Fetch profile
  const { data: profileData, error: profileError } = await supabase
    .from('organization_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    throw profileError;
  }

  // Fetch interest topics
  const { data: topicsData, error: topicsError } = await supabase
    .from('org_interest_topics')
    .select('*')
    .eq('organization_id', organizationId)
    .order('weight', { ascending: false });

  if (topicsError) throw topicsError;

  // Fetch interest entities
  const { data: entitiesData, error: entitiesError } = await supabase
    .from('org_interest_entities')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (entitiesError) throw entitiesError;

  // Fetch alert preferences
  const { data: prefsData, error: prefsError } = await supabase
    .from('org_alert_preferences')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (prefsError && prefsError.code !== 'PGRST116') {
    throw prefsError;
  }

  return {
    profile: profileData ? {
      org_type: profileData.org_type,
      display_name: profileData.display_name,
      mission_summary: profileData.mission_summary,
      focus_areas: profileData.focus_areas,
      key_issues: profileData.key_issues,
      geographies: profileData.geographies,
      primary_goals: profileData.primary_goals,
      audiences: profileData.audiences,
    } : null,
    interestTopics: (topicsData || []).map(t => ({
      topic: t.topic,
      weight: t.weight,
      source: t.source as OrgInterestTopic['source'],
    })),
    interestEntities: (entitiesData || []).map(e => ({
      entity_name: e.entity_name,
      rule_type: e.rule_type as 'allow' | 'deny',
      reason: e.reason,
    })),
    alertPreferences: prefsData ? {
      min_relevance_score: prefsData.min_relevance_score,
      min_urgency_score: prefsData.min_urgency_score,
      max_alerts_per_day: prefsData.max_alerts_per_day,
      digest_mode: prefsData.digest_mode as OrgAlertPreferences['digest_mode'],
    } : null,
  };
}

// ============================================================================
// Hooks
// ============================================================================

export function useOrgProfileQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: orgProfileKeys.full(organizationId || ''),
    queryFn: () => fetchOrgProfile(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ============================================================================
// Mutation: Update Profile
// ============================================================================

interface UpdateProfileInput {
  org_type?: string;
  display_name?: string;
  mission_summary?: string;
  geographies?: string[];
  primary_goals?: string[];
  audiences?: string[];
  channels_enabled?: string[];
  sensitivity_redlines?: Record<string, unknown>;
}

export function useUpdateOrgProfile(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!organizationId) throw new Error('No organization ID');

      // Build update object with proper typing
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (input.org_type !== undefined) updateData.org_type = input.org_type;
      if (input.display_name !== undefined) updateData.display_name = input.display_name;
      if (input.mission_summary !== undefined) updateData.mission_summary = input.mission_summary;
      if (input.geographies !== undefined) updateData.geographies = input.geographies;
      if (input.primary_goals !== undefined) updateData.primary_goals = input.primary_goals;
      if (input.audiences !== undefined) updateData.audiences = input.audiences;
      if (input.channels_enabled !== undefined) updateData.channels_enabled = input.channels_enabled;
      if (input.sensitivity_redlines !== undefined) updateData.sensitivity_redlines = input.sensitivity_redlines;

      // Check if profile exists
      const { data: existing } = await supabase
        .from('organization_profiles')
        .select('id')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('organization_profiles')
          .update(updateData as any)
          .eq('organization_id', organizationId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('organization_profiles')
          .insert({
            organization_id: organizationId,
            ...updateData,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgProfileKeys.full(organizationId!) });
    },
  });
}

// ============================================================================
// Mutation: Update Interest Topics
// ============================================================================

interface UpdateTopicsInput {
  topics: { topic: string; weight: number }[];
}

export function useUpdateInterestTopics(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ topics }: UpdateTopicsInput) => {
      if (!organizationId) throw new Error('No organization ID');

      // Delete existing self_declared topics
      await supabase
        .from('org_interest_topics')
        .delete()
        .eq('organization_id', organizationId)
        .eq('source', 'self_declared');

      // Insert new topics
      if (topics.length > 0) {
        const { error } = await supabase
          .from('org_interest_topics')
          .insert(
            topics.map(t => ({
              organization_id: organizationId,
              topic: t.topic,
              weight: t.weight,
              source: 'self_declared',
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgProfileKeys.full(organizationId!) });
    },
  });
}

// ============================================================================
// Mutation: Add/Update Interest Entity
// ============================================================================

interface UpsertEntityInput {
  entity_name: string;
  rule_type: 'allow' | 'deny';
  reason?: string;
}

export function useUpsertInterestEntity(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertEntityInput) => {
      if (!organizationId) throw new Error('No organization ID');

      const { error } = await supabase
        .from('org_interest_entities')
        .upsert({
          organization_id: organizationId,
          entity_name: input.entity_name,
          rule_type: input.rule_type,
          reason: input.reason,
        }, {
          onConflict: 'organization_id,entity_name',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgProfileKeys.full(organizationId!) });
    },
  });
}

// ============================================================================
// Mutation: Remove Interest Entity
// ============================================================================

export function useRemoveInterestEntity(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entityName: string) => {
      if (!organizationId) throw new Error('No organization ID');

      const { error } = await supabase
        .from('org_interest_entities')
        .delete()
        .eq('organization_id', organizationId)
        .eq('entity_name', entityName);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgProfileKeys.full(organizationId!) });
    },
  });
}

// ============================================================================
// Mutation: Update Alert Preferences
// ============================================================================

interface UpdatePreferencesInput {
  min_relevance_score?: number;
  min_urgency_score?: number;
  max_alerts_per_day?: number;
  digest_mode?: 'realtime' | 'hourly_digest' | 'daily_digest';
  quiet_hours?: { enabled: boolean; start?: string; end?: string; tz?: string };
  notify_channels?: string[];
}

export function useUpdateAlertPreferences(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePreferencesInput) => {
      if (!organizationId) throw new Error('No organization ID');

      const { error } = await supabase
        .from('org_alert_preferences')
        .upsert({
          organization_id: organizationId,
          ...input,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgProfileKeys.full(organizationId!) });
    },
  });
}
