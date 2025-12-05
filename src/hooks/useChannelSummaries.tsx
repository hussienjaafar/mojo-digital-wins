import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChannelSummary = {
  meta: {
    spend: number;
    conversions: number;
    roas: number;
    hasConversionValueData: boolean;
    isLoading: boolean;
    lastDataDate: string | null;
  };
  sms: {
    sent: number;
    raised: number;
    roi: number;
    isLoading: boolean;
    lastDataDate: string | null;
    campaignCount: number;
  };
  donations: {
    total: number;
    donors: number;
    avgDonation: number;
    isLoading: boolean;
    lastDataDate: string | null;
  };
};

export function useChannelSummaries(organizationId: string, startDate: string, endDate: string): ChannelSummary {
  const [summary, setSummary] = useState<ChannelSummary>({
    meta: { spend: 0, conversions: 0, roas: 0, hasConversionValueData: false, isLoading: true, lastDataDate: null },
    sms: { sent: 0, raised: 0, roi: 0, isLoading: true, lastDataDate: null, campaignCount: 0 },
    donations: { total: 0, donors: 0, avgDonation: 0, isLoading: true, lastDataDate: null },
  });

  useEffect(() => {
    if (!organizationId) return;

    const loadSummaries = async () => {
      // Fetch Meta Ads summary
      try {
        const { data: metaData } = await (supabase as any)
          .from('meta_ad_metrics')
          .select('spend, conversions, conversion_value, date')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        const metaSpend = metaData?.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0) || 0;
        const metaConversions = metaData?.reduce((sum: number, m: any) => sum + (m.conversions || 0), 0) || 0;
        const metaValue = metaData?.reduce((sum: number, m: any) => sum + Number(m.conversion_value || 0), 0) || 0;
        const hasConversionValueData = metaValue > 0;
        const metaRoas = metaSpend > 0 && metaValue > 0 ? metaValue / metaSpend : 0;
        const lastMetaDate = metaData?.[0]?.date || null;

        setSummary(prev => ({
          ...prev,
          meta: { spend: metaSpend, conversions: metaConversions, roas: metaRoas, hasConversionValueData, isLoading: false, lastDataDate: lastMetaDate },
        }));
      } catch (error) {
        setSummary(prev => ({ ...prev, meta: { ...prev.meta, isLoading: false } }));
      }

      // Fetch SMS summary from sms_campaigns table (not sms_campaign_metrics)
      try {
        const { data: smsData } = await (supabase as any)
          .from('sms_campaigns')
          .select('messages_sent, amount_raised, cost, send_date, status')
          .eq('organization_id', organizationId)
          .gte('send_date', startDate)
          .lte('send_date', `${endDate}T23:59:59`)
          .neq('status', 'draft')
          .order('send_date', { ascending: false });

        const smsSent = smsData?.reduce((sum: number, m: any) => sum + (m.messages_sent || 0), 0) || 0;
        const smsRaised = smsData?.reduce((sum: number, m: any) => sum + Number(m.amount_raised || 0), 0) || 0;
        const smsCost = smsData?.reduce((sum: number, m: any) => sum + Number(m.cost || 0), 0) || 0;
        const smsRoi = smsCost > 0 ? smsRaised / smsCost : 0;
        const lastSmsDate = smsData?.[0]?.send_date?.split('T')[0] || null;

        setSummary(prev => ({
          ...prev,
          sms: { sent: smsSent, raised: smsRaised, roi: smsRoi, isLoading: false, lastDataDate: lastSmsDate, campaignCount: smsData?.length || 0 },
        }));
      } catch (error) {
        setSummary(prev => ({ ...prev, sms: { ...prev.sms, isLoading: false } }));
      }

      // Fetch Donations summary
      try {
        console.log('[useChannelSummaries] Fetching donations for org:', organizationId, 'dates:', startDate, 'to', endDate);
        
        const { data: donationData, error: donationError } = await (supabase as any)
          .from('actblue_transactions')
          .select('amount, donor_email, transaction_date')
          .eq('organization_id', organizationId)
          .gte('transaction_date', startDate)
          .lte('transaction_date', `${endDate}T23:59:59`)
          .order('transaction_date', { ascending: false });

        if (donationError) {
          console.error('[useChannelSummaries] Donation query error:', donationError);
        }
        
        console.log('[useChannelSummaries] Donations found:', donationData?.length || 0);

        const total = donationData?.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) || 0;
        const uniqueDonors = new Set(donationData?.map((d: any) => d.donor_email)).size;
        const avgDonation = donationData?.length > 0 ? total / donationData.length : 0;
        const lastDonationDate = donationData?.[0]?.transaction_date?.split('T')[0] || null;

        console.log('[useChannelSummaries] Calculated totals:', { total, uniqueDonors, avgDonation });

        setSummary(prev => ({
          ...prev,
          donations: { total, donors: uniqueDonors, avgDonation, isLoading: false, lastDataDate: lastDonationDate },
        }));
      } catch (error) {
        console.error('[useChannelSummaries] Donation fetch error:', error);
        setSummary(prev => ({ ...prev, donations: { ...prev.donations, isLoading: false } }));
      }
    };

    loadSummaries();
  }, [organizationId, startDate, endDate]);

  return summary;
}
