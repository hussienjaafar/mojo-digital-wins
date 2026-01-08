import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTrendActionTracking } from './useTrendActionTracking';

export interface GeneratedMessage {
  message: string;
  approach: 'emotional' | 'factual' | 'urgent';
  predicted_performance: number;
}

export interface CampaignGeneratorParams {
  organizationId: string;
  entityName: string;
  entityType?: string;
  opportunityContext?: string;
  numVariants?: number;
  trendEventId?: string;
}

interface CampaignGeneratorState {
  messages: GeneratedMessage[];
  isGenerating: boolean;
  error: string | null;
  selectedVariant: number | null;
}

export function useCampaignGenerator() {
  const [state, setState] = useState<CampaignGeneratorState>({
    messages: [],
    isGenerating: false,
    error: null,
    selectedVariant: null,
  });

  const { trackAction } = useTrendActionTracking();

  const generateMessages = async (params: CampaignGeneratorParams): Promise<GeneratedMessage[]> => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-messages', {
        body: {
          organization_id: params.organizationId,
          entity_name: params.entityName,
          entity_type: params.entityType || 'trend',
          opportunity_context: params.opportunityContext,
          num_variants: params.numVariants || 3,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success || !data?.messages) {
        throw new Error(data?.error || 'Failed to generate messages');
      }

      const messages = data.messages as GeneratedMessage[];
      
      setState(prev => ({
        ...prev,
        messages,
        isGenerating: false,
        selectedVariant: 0, // Auto-select first variant
      }));

      // Track the generation action
      if (params.trendEventId) {
        await trackAction({
          trendEventId: params.trendEventId,
          organizationId: params.organizationId,
          actionType: 'generate_campaign',
          metadata: {
            variants_generated: messages.length,
            entity_name: params.entityName,
          },
        });
      }

      return messages;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate campaign messages';
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: errorMessage,
      }));
      throw err;
    }
  };

  const selectVariant = (index: number) => {
    setState(prev => ({ ...prev, selectedVariant: index }));
  };

  const copyToClipboard = async (message: string, params?: {
    trendEventId?: string;
    organizationId?: string;
    channel?: string;
  }): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(message);
      
      // Track the copy action
      if (params?.trendEventId && params?.organizationId) {
        await trackAction({
          trendEventId: params.trendEventId,
          organizationId: params.organizationId,
          actionType: 'sms',
          metadata: {
            action: 'copy_campaign_message',
            channel: params.channel || 'sms',
            message_length: message.length,
          },
        });
      }
      
      return true;
    } catch {
      return false;
    }
  };

  const reset = () => {
    setState({
      messages: [],
      isGenerating: false,
      error: null,
      selectedVariant: null,
    });
  };

  return {
    ...state,
    generateMessages,
    selectVariant,
    copyToClipboard,
    reset,
  };
}
