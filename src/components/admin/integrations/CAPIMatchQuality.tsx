/**
 * CAPI Match Quality Dashboard
 * 
 * Displays real-time metrics about the quality of Meta CAPI event matching,
 * showing what percentage of donations have fbp/fbc identifiers and
 * expected match rates.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  TrendingUp,
  Cookie,
  Link2,
  Mail,
} from 'lucide-react';

interface CAPIMatchQualityProps {
  organizationId: string;
  daysBack?: number;
}

interface MatchQualityMetrics {
  totalDonations: number;
  withFbp: number;
  withFbc: number;
  withFbclid: number;
  withEmail: number;
  withPhone: number;
  estimatedMatchRate: number;
  qualityScore: 'excellent' | 'good' | 'fair' | 'poor';
}

function calculateEstimatedMatchRate(metrics: {
  withFbp: number;
  withFbc: number;
  withEmail: number;
  withPhone: number;
  total: number;
}): number {
  if (metrics.total === 0) return 0;
  
  // Meta match rate estimates based on identifier quality:
  // - fbp + fbc: 95%+ match rate (best)
  // - fbp only: 80%+ match rate
  // - fbc/fbclid: 70%+ match rate
  // - email only: 40-60% match rate
  // - email + phone: 60-75% match rate
  
  const fbpFbcCount = Math.min(metrics.withFbp, metrics.withFbc);
  const fbpOnlyCount = metrics.withFbp - fbpFbcCount;
  const fbcOnlyCount = metrics.withFbc - fbpFbcCount;
  const emailPhoneCount = Math.min(metrics.withEmail, metrics.withPhone);
  const emailOnlyCount = metrics.withEmail - emailPhoneCount - fbpFbcCount - fbpOnlyCount - fbcOnlyCount;
  
  const weightedMatches = 
    (fbpFbcCount * 0.95) +
    (fbpOnlyCount * 0.80) +
    (fbcOnlyCount * 0.70) +
    (emailPhoneCount * 0.70) +
    (Math.max(0, emailOnlyCount) * 0.50);
  
  return Math.min(100, (weightedMatches / metrics.total) * 100);
}

function getQualityScore(metrics: MatchQualityMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
  if (metrics.estimatedMatchRate >= 80) return 'excellent';
  if (metrics.estimatedMatchRate >= 60) return 'good';
  if (metrics.estimatedMatchRate >= 40) return 'fair';
  return 'poor';
}

export function CAPIMatchQuality({ organizationId, daysBack = 30 }: CAPIMatchQualityProps) {
  // Fetch touchpoint quality metrics
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['capi-match-quality', organizationId, daysBack],
    queryFn: async (): Promise<MatchQualityMetrics> => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      // Get recent donations with their touchpoint data
      const { data: donations, error: donationError } = await supabase
        .from('actblue_transactions')
        .select('id, donor_email, phone, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (donationError) throw donationError;
      
      // Get touchpoints with Meta identifiers
      const { data: touchpoints, error: touchpointError } = await supabase
        .from('attribution_touchpoints')
        .select('donor_email, metadata')
        .eq('organization_id', organizationId)
        .gte('occurred_at', startDate.toISOString())
        .not('metadata', 'is', null);
      
      if (touchpointError) throw touchpointError;
      
      // Create lookup map of emails with Meta identifiers
      const emailsWithFbp = new Set<string>();
      const emailsWithFbc = new Set<string>();
      const emailsWithFbclid = new Set<string>();
      
      touchpoints?.forEach(tp => {
        if (!tp.donor_email || !tp.metadata) return;
        const email = tp.donor_email.toLowerCase();
        const meta = tp.metadata as Record<string, any>;
        
        if (meta.fbp) emailsWithFbp.add(email);
        if (meta.fbc) emailsWithFbc.add(email);
        if (meta.fbclid) emailsWithFbclid.add(email);
      });
      
      // Calculate metrics for donations
      const totalDonations = donations?.length || 0;
      let withFbp = 0;
      let withFbc = 0;
      let withFbclid = 0;
      let withEmail = 0;
      let withPhone = 0;
      
      donations?.forEach(donation => {
        if (donation.donor_email) {
          withEmail++;
          const email = donation.donor_email.toLowerCase();
          if (emailsWithFbp.has(email)) withFbp++;
          if (emailsWithFbc.has(email)) withFbc++;
          if (emailsWithFbclid.has(email)) withFbclid++;
        }
        if (donation.phone) withPhone++;
      });
      
      const estimatedMatchRate = calculateEstimatedMatchRate({
        withFbp,
        withFbc,
        withEmail,
        withPhone,
        total: totalDonations,
      });
      
      const result: MatchQualityMetrics = {
        totalDonations,
        withFbp,
        withFbc,
        withFbclid,
        withEmail,
        withPhone,
        estimatedMatchRate,
        qualityScore: 'fair',
      };
      
      result.qualityScore = getQualityScore(result);
      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!organizationId,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-8 bg-muted rounded" />
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading match quality</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load metrics'}
        </AlertDescription>
      </Alert>
    );
  }

  const qualityColors = {
    excellent: 'text-green-600 bg-green-500/10 border-green-500/30',
    good: 'text-blue-600 bg-blue-500/10 border-blue-500/30',
    fair: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30',
    poor: 'text-red-600 bg-red-500/10 border-red-500/30',
  };

  const QualityIcon = {
    excellent: CheckCircle2,
    good: TrendingUp,
    fair: AlertTriangle,
    poor: XCircle,
  }[metrics.qualityScore];

  return (
    <div className="space-y-4">
      {/* Header with quality score */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Match Quality</h4>
          <p className="text-xs text-muted-foreground">Last {daysBack} days</p>
        </div>
        <Badge className={qualityColors[metrics.qualityScore]}>
          <QualityIcon className="h-3 w-3 mr-1" />
          {metrics.qualityScore.charAt(0).toUpperCase() + metrics.qualityScore.slice(1)}
        </Badge>
      </div>

      {/* Estimated match rate */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Estimated Match Rate</span>
          <span className="font-medium">{metrics.estimatedMatchRate.toFixed(0)}%</span>
        </div>
        <Progress value={metrics.estimatedMatchRate} className="h-2" />
      </div>

      {/* Identifier breakdown */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
          <Cookie className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{metrics.withFbp}</div>
            <div className="text-xs text-muted-foreground">With FBP Cookie</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{metrics.withFbc}</div>
            <div className="text-xs text-muted-foreground">With FBC/Click ID</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{metrics.withEmail}</div>
            <div className="text-xs text-muted-foreground">With Email</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{metrics.totalDonations}</div>
            <div className="text-xs text-muted-foreground">Total Donations</div>
          </div>
        </div>
      </div>

      {/* Guidance based on quality */}
      {metrics.qualityScore === 'poor' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Improve Match Rate</AlertTitle>
          <AlertDescription className="text-xs">
            Most donations lack Meta identifiers. Set up a landing page that captures
            fbp/fbc cookies before redirecting to ActBlue.
          </AlertDescription>
        </Alert>
      )}

      {metrics.qualityScore === 'fair' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Moderate Match Quality</AlertTitle>
          <AlertDescription className="text-xs">
            Some donations have Meta identifiers. Ensure all Meta ads point to your
            landing page first, not directly to ActBlue.
          </AlertDescription>
        </Alert>
      )}

      {metrics.qualityScore === 'excellent' && (
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">Excellent Match Quality</AlertTitle>
          <AlertDescription className="text-xs">
            Most donations have Meta browser cookies for accurate deduplication.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default CAPIMatchQuality;
