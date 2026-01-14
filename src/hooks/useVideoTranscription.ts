/**
 * Video Transcription Hook
 *
 * Provides functionality to:
 * - Fetch transcription status for ads
 * - Trigger video sync for an organization
 * - Trigger transcription for specific videos
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AdVideoTranscription, VideoTranscriptionStatus } from '@/types/adPerformance';

// Query keys
export const transcriptionKeys = {
  all: ['video-transcription'] as const,
  status: (orgId: string, adIds: string[]) =>
    [...transcriptionKeys.all, 'status', orgId, adIds.sort().join(',')] as const,
  stats: (orgId: string) => [...transcriptionKeys.all, 'stats', orgId] as const,
};

interface TranscriptionStatusMap {
  [adId: string]: AdVideoTranscription | null;
}

interface TranscriptionStats {
  total_videos: number;
  pending: number;
  url_fetched: number;
  downloaded: number;
  transcribed: number;
  errors: number;
  transcription_rate: number;
}

/**
 * Fetch transcription status for multiple ads
 */
export function useTranscriptionStatus(organizationId: string, adIds: string[]) {
  return useQuery<TranscriptionStatusMap>({
    queryKey: transcriptionKeys.status(organizationId, adIds),
    queryFn: async () => {
      if (!adIds.length) return {};

      // Fetch video status
      const { data: videos, error: videosError } = await (supabase as any)
        .from('meta_ad_videos')
        .select('ad_id, video_id, status, error_message, duration_seconds, transcribed_at')
        .eq('organization_id', organizationId)
        .in('ad_id', adIds);

      if (videosError) {
        console.error('[Transcription] Error fetching video status:', videosError);
        return {};
      }

      // Fetch transcripts for transcribed videos
      const transcribedAdIds = (videos || [])
        .filter((v: any) => v.status === 'TRANSCRIBED')
        .map((v: any) => v.ad_id);

      let transcripts: any[] = [];
      if (transcribedAdIds.length > 0) {
        const { data, error } = await (supabase as any)
          .from('meta_ad_transcripts')
          .select(`
            ad_id,
            video_id,
            transcript_text,
            duration_seconds,
            language,
            speaker_count,
            words_per_minute,
            hook_text,
            topic_primary,
            topic_tags,
            tone_primary,
            tone_tags,
            sentiment_score,
            urgency_level,
            cta_text,
            cta_type,
            key_phrases,
            transcribed_at
          `)
          .eq('organization_id', organizationId)
          .in('ad_id', transcribedAdIds);

        if (!error && data) {
          transcripts = data;
        }
      }

      // Build map
      const transcriptsByAdId = new Map<string, any>();
      for (const t of transcripts) {
        transcriptsByAdId.set(t.ad_id, t);
      }

      const result: TranscriptionStatusMap = {};
      for (const video of videos || []) {
        const transcript = transcriptsByAdId.get(video.ad_id);

        result[video.ad_id] = {
          video_id: video.video_id,
          status: video.status as VideoTranscriptionStatus,
          transcript_text: transcript?.transcript_text || null,
          duration_seconds: transcript?.duration_seconds || video.duration_seconds || null,
          language: transcript?.language || null,
          speaker_count: transcript?.speaker_count || null,
          words_per_minute: transcript?.words_per_minute || null,
          hook_text: transcript?.hook_text || null,
          topic_primary: transcript?.topic_primary || null,
          topic_tags: transcript?.topic_tags || null,
          tone_primary: transcript?.tone_primary || null,
          tone_tags: transcript?.tone_tags || null,
          sentiment_score: transcript?.sentiment_score || null,
          urgency_level: transcript?.urgency_level || null,
          cta_text: transcript?.cta_text || null,
          cta_type: transcript?.cta_type || null,
          key_phrases: transcript?.key_phrases || null,
          error_message: video.error_message || null,
          transcribed_at: transcript?.transcribed_at || video.transcribed_at || null,
        };
      }

      return result;
    },
    enabled: !!organizationId && adIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch transcription stats for an organization
 */
export function useTranscriptionStats(organizationId: string) {
  return useQuery<TranscriptionStats>({
    queryKey: transcriptionKeys.stats(organizationId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc('get_transcription_stats', { p_organization_id: organizationId });

      if (error) {
        console.error('[Transcription] Error fetching stats:', error);
        throw error;
      }

      return data?.[0] || {
        total_videos: 0,
        pending: 0,
        url_fetched: 0,
        downloaded: 0,
        transcribed: 0,
        errors: 0,
        transcription_rate: 0,
      };
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Mutation to sync video metadata from Meta API
 */
export function useSyncVideos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      adAccountId,
      startDate,
      endDate,
      adIds,
    }: {
      organizationId: string;
      adAccountId?: string;
      startDate?: string;
      endDate?: string;
      adIds?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('sync-meta-ad-videos', {
        body: {
          organization_id: organizationId,
          ad_account_id: adAccountId,
          start_date: startDate,
          end_date: endDate,
          ad_ids: adIds,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate transcription queries
      queryClient.invalidateQueries({
        queryKey: transcriptionKeys.all,
      });
    },
  });
}

/**
 * Mutation to transcribe a single video
 */
export function useTranscribeVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      videoId,
      adId,
    }: {
      organizationId: string;
      videoId: string;
      adId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('transcribe-meta-ad-video', {
        body: {
          organization_id: organizationId,
          video_id: videoId,
          ad_id: adId,
          mode: 'single',
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: transcriptionKeys.all,
      });
    },
  });
}

/**
 * Mutation to transcribe multiple pending videos
 */
export function useTranscribeBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      limit = 5,
    }: {
      organizationId: string;
      limit?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('transcribe-meta-ad-video', {
        body: {
          organization_id: organizationId,
          mode: 'batch',
          limit,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: transcriptionKeys.all,
      });
    },
  });
}

/**
 * Get display-friendly status label
 */
export function getTranscriptionStatusLabel(status: VideoTranscriptionStatus | undefined): string {
  switch (status) {
    case 'TRANSCRIBED':
      return 'Transcribed';
    case 'PENDING':
    case 'URL_FETCHED':
    case 'DOWNLOADED':
      return 'Pending';
    case 'URL_EXPIRED':
    case 'URL_INACCESSIBLE':
      return 'Unavailable';
    case 'TRANSCRIPT_FAILED':
    case 'ERROR':
      return 'Error';
    case 'NO_VIDEO':
    default:
      return 'No Video';
  }
}

/**
 * Get status color for UI
 */
export function getTranscriptionStatusColor(status: VideoTranscriptionStatus | undefined): string {
  switch (status) {
    case 'TRANSCRIBED':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'PENDING':
    case 'URL_FETCHED':
    case 'DOWNLOADED':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'URL_EXPIRED':
    case 'URL_INACCESSIBLE':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'TRANSCRIPT_FAILED':
    case 'ERROR':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
}
