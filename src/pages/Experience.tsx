import { useState, useCallback, startTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import FunnelContainer from '@/components/funnel/FunnelContainer';
import FunnelProgress from '@/components/funnel/FunnelProgress';
import WelcomeStep from '@/components/funnel/steps/WelcomeStep';
import SegmentChannelStep from '@/components/funnel/steps/SegmentChannelStep';
import CommercialOpportunityStep from '@/components/funnel/steps/CommercialOpportunityStep';
import PoliticalOpportunityStep from '@/components/funnel/steps/PoliticalOpportunityStep';
import CommercialProofStep from '@/components/funnel/steps/CommercialProofStep';
import PoliticalProofStep from '@/components/funnel/steps/PoliticalProofStep';
import QualificationStep, { type QualificationData } from '@/components/funnel/steps/QualificationStep';
import ThankYouStep from '@/components/funnel/steps/ThankYouStep';
import { useFunnelSession } from '@/hooks/useFunnelSession';
import { useAbandonedLeadCapture } from '@/hooks/useAbandonedLeadCapture';
import { useFunnelAnalytics } from '@/hooks/useFunnelAnalytics';
import { useFunnelVariants } from '@/hooks/useFunnelVariants';
import { supabase } from '@/integrations/supabase/client';
import { trackCustomEvent } from '@/components/MetaPixel';

const TOTAL_STEPS = 6;

export default function Experience() {
  const session = useFunnelSession();
  const { captureEmail } = useAbandonedLeadCapture({
    sessionId: session.sessionId,
    variant: session.variant,
    segment: session.segment,
    utmSource: session.utmParams.utm_source,
    utmCampaign: session.utmParams.utm_campaign,
  });
  const analytics = useFunnelAnalytics({
    sessionId: session.sessionId,
    variant: session.variant,
    segment: session.segment,
  });
  const { data: variants } = useFunnelVariants(session.variant);

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [prefillEmail, setPrefillEmail] = useState('');
  const [prefillOrg, setPrefillOrg] = useState('');
  const [redirectToCalendar, setRedirectToCalendar] = useState(false);
  const [leadScore, setLeadScore] = useState(0);

  const goTo = useCallback((step: number) => {
    startTransition(() => {
      setDirection(step > currentStep ? 1 : -1);
      setCurrentStep(step);
    });
  }, [currentStep]);

  const goNext = useCallback(() => {
    startTransition(() => {
      setDirection(1);
      setCurrentStep(s => s + 1);
    });
  }, []);

  const goBack = useCallback(() => {
    if (currentStep <= 0) return;
    startTransition(() => {
      setDirection(-1);
      setCurrentStep(s => s - 1);
    });
  }, [currentStep]);

  // Track step views
  const getStepKey = (step: number): string => {
    if (step === 0) return 'welcome';
    if (step === 1) return 'segment_select';
    if (step === 2) return session.segment === 'commercial' ? 'commercial_opportunity' : 'political_opportunity';
    if (step === 3) return session.segment === 'commercial' ? 'commercial_proof' : 'political_proof';
    if (step === 4) return 'qualification';
    return 'thank_you';
  };

  // Step 0 handlers
  const handleWelcomeNext = (email: string, org: string) => {
    setPrefillEmail(email);
    setPrefillOrg(org);
    captureEmail(email, org);
    analytics.trackStepView('welcome', 0);
    goNext();
  };

  const handleEmailBlur = (email: string, org: string) => {
    captureEmail(email, org);
  };

  // Step 1 handlers
  const handleSegmentSelect = (seg: string) => {
    session.setSegment(seg);
    analytics.trackSegmentSelected(seg);
  };

  const handleChannelsChange = (channels: string[]) => {
    session.setSelectedChannels(channels);
  };

  // Step 4 handler
  const handleQualificationSubmit = async (data: QualificationData) => {
    analytics.trackLeadSubmitted(data.budgetRange);

    // Upsert lead
    await supabase.from('funnel_leads').upsert(
      {
        session_id: session.sessionId,
        segment: session.segment,
        variant_label: session.variant,
        name: data.name,
        email: data.email,
        organization: data.organization,
        role: data.role,
        is_decision_maker: data.isDecisionMaker,
        budget_range: data.budgetRange,
        selected_channels: session.selectedChannels,
        buying_authority_info: data.buyingAuthorityInfo,
        performance_kpis: data.performanceKpis,
        utm_source: session.utmParams.utm_source,
        utm_campaign: session.utmParams.utm_campaign,
        status: 'submitted',
      } as any,
      { onConflict: 'session_id' }
    );

    // Call edge function for scoring
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/funnel-lead-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
        },
        body: JSON.stringify({
          session_id: session.sessionId,
          name: data.name,
          email: data.email,
          organization: data.organization,
          role: data.role,
          is_decision_maker: data.isDecisionMaker,
          budget_range: data.budgetRange,
          selected_channels: session.selectedChannels,
          buying_authority_info: data.buyingAuthorityInfo,
          performance_kpis: data.performanceKpis,
          segment: session.segment,
          variant_label: session.variant,
        }),
      });
      const result = await response.json();
      setRedirectToCalendar(result.redirect_to_calendar || false);
      setLeadScore(result.lead_score || 0);
    } catch {
      // Proceed anyway
    }

    // Fire Lead_Qualified browser-side if budget >= $10k
    if (data.budgetRange === '$10k-$50k' || data.budgetRange === '$50k+') {
      analytics.trackLeadQualified(data.budgetRange);
    }

    goNext();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <WelcomeStep
            content={variants?.welcome}
            onNext={handleWelcomeNext}
            onEmailBlur={handleEmailBlur}
          />
        );
      case 1:
        return (
          <SegmentChannelStep
            content={variants?.segment_select}
            segment={session.segment}
            selectedChannels={session.selectedChannels}
            onSegmentSelect={handleSegmentSelect}
            onChannelsChange={handleChannelsChange}
            onNext={goNext}
          />
        );
      case 2:
        return session.segment === 'commercial' ? (
          <CommercialOpportunityStep content={variants?.commercial_opportunity} onNext={goNext} />
        ) : (
          <PoliticalOpportunityStep content={variants?.political_opportunity} onNext={goNext} />
        );
      case 3:
        return session.segment === 'commercial' ? (
          <CommercialProofStep content={variants?.commercial_proof} onNext={goNext} />
        ) : (
          <PoliticalProofStep content={variants?.political_proof} onNext={goNext} />
        );
      case 4:
        return (
          <QualificationStep
            content={variants?.qualification}
            segment={session.segment}
            selectedChannels={session.selectedChannels}
            prefillEmail={prefillEmail}
            prefillOrg={prefillOrg}
            onSubmit={handleQualificationSubmit}
          />
        );
      case 5:
        return (
          <ThankYouStep
            content={variants?.thank_you}
            redirectToCalendar={redirectToCalendar}
            leadScore={leadScore}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0f1a] text-white overflow-hidden">
      <FunnelContainer
        currentStep={currentStep}
        direction={direction}
        onNext={currentStep < TOTAL_STEPS - 1 ? goNext : undefined}
        onBack={currentStep > 0 ? goBack : undefined}
      >
        {renderStep()}
      </FunnelContainer>
      <FunnelProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
    </div>
  );
}
