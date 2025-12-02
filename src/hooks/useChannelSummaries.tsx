import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";

export type ChannelSummary = {
  meta: {
    spend: number;
    conversions: number;
    roas: number;
    isLoading: boolean;
  };
  sms: {
    sent: number;
    raised: number;
    roi: number;
    isLoading: boolean;
  };
  donations: {
    total: number;
    donors: number;
    avgDonation: number;
    isLoading: boolean;
  };
};

export function useChannelSummaries(organizationId: string, startDate: string, endDate: string): ChannelSummary {
  const [summary, setSummary] = useState<ChannelSummary>({
    meta: { spend: 0, conversions: 0, roas: 0, isLoading: true },
    sms: { sent: 0, raised: 0, roi: 0, isLoading: true },
    donations: { total: 0, donors: 0, avgDonation: 0, isLoading: true },
  });

  useEffect(() => {
    if (!organizationId) return;

    const loadSummaries = async () => {
      // Fetch Meta Ads summary
      try {
        const { data: metaData } = await (supabase as any)
          .from('meta_ad_metrics')
          .select('spend, conversions, conversion_value')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate);

        const metaSpend = metaData?.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0) || 0;
        const metaConversions = metaData?.reduce((sum: number, m: any) => sum + (m.conversions || 0), 0) || 0;
        const metaValue = metaData?.reduce((sum: number, m: any) => sum + Number(m.conversion_value || 0), 0) || 0;
        const metaRoas = metaSpend > 0 ? metaValue / metaSpend : 0;

        setSummary(prev => ({
          ...prev,
          meta: { spend: metaSpend, conversions: metaConversions, roas: metaRoas, isLoading: false },
        }));
      } catch (error) {
        setSummary(prev => ({ ...prev, meta: { ...prev.meta, isLoading: false } }));
      }

      // Fetch SMS summary
      try {
        const { data: smsData } = await (supabase as any)
          .from('sms_campaign_metrics')
          .select('messages_sent, amount_raised, cost')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate);

        const smsSent = smsData?.reduce((sum: number, m: any) => sum + (m.messages_sent || 0), 0) || 0;
        const smsRaised = smsData?.reduce((sum: number, m: any) => sum + Number(m.amount_raised || 0), 0) || 0;
        const smsCost = smsData?.reduce((sum: number, m: any) => sum + Number(m.cost || 0), 0) || 0;
        const smsRoi = smsCost > 0 ? smsRaised / smsCost : 0;

        setSummary(prev => ({
          ...prev,
          sms: { sent: smsSent, raised: smsRaised, roi: smsRoi, isLoading: false },
        }));
      } catch (error) {
        setSummary(prev => ({ ...prev, sms: { ...prev.sms, isLoading: false } }));
      }

      // Fetch Donations summary
      try {
        const { data: donationData } = await (supabase as any)
          .from('actblue_transactions')
          .select('amount, donor_email')
          .eq('organization_id', organizationId)
          .eq('transaction_type', 'donation')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);

        const total = donationData?.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) || 0;
        const uniqueDonors = new Set(donationData?.map((d: any) => d.donor_email)).size;
        const avgDonation = donationData?.length > 0 ? total / donationData.length : 0;

        setSummary(prev => ({
          ...prev,
          donations: { total, donors: uniqueDonors, avgDonation, isLoading: false },
        }));
      } catch (error) {
        setSummary(prev => ({ ...prev, donations: { ...prev.donations, isLoading: false } }));
      }
    };

    loadSummaries();
  }, [organizationId, startDate, endDate]);

  return summary;
}
