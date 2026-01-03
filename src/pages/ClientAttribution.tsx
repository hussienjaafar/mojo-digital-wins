import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ClientLayout } from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { V3PageContainer, V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent, V3KPICard, V3EmptyState } from "@/components/v3";
import { GitBranch, DollarSign, TrendingUp, AlertCircle, CheckCircle, Sparkles, RefreshCw, ArrowRight } from "lucide-react";

interface Attribution {
  id: string;
  refcode: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  meta_campaign_id: string | null;
  switchboard_campaign_id: string | null;
  match_confidence: number | null;
  is_auto_matched: boolean | null;
  match_reason: string | null;
  attributed_revenue: number | null;
  attributed_transactions: number | null;
  created_at: string | null;
}

interface SuggestedMatch {
  refcode: string;
  revenue: number;
  transactions: number;
  suggested_campaign: string;
  confidence: number;
  reason: string;
}

const ClientAttribution = () => {
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [suggestedMatches, setSuggestedMatches] = useState<SuggestedMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningMatcher, setIsRunningMatcher] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    matchedRevenue: 0,
    unmatchedRevenue: 0,
    matchRate: 0,
  });

  useEffect(() => {
    loadOrganization();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadAttributions();
    }
  }, [organizationId]);

  const loadOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/client-login");
        return;
      }

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (clientUser?.organization_id) {
        setOrganizationId(clientUser.organization_id);
      }
    } catch (error) {
      console.error("Error loading organization:", error);
    }
  };

  const loadAttributions = async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      // Load existing attributions
      const { data: attrData, error: attrError } = await supabase
        .from("campaign_attribution")
        .select("*")
        .eq("organization_id", organizationId)
        .order("attributed_revenue", { ascending: false, nullsFirst: false });

      if (attrError) throw attrError;
      setAttributions(attrData || []);

      // Calculate stats from ActBlue transactions
      const { data: txData } = await supabase
        .from("actblue_transactions")
        .select("amount, refcode")
        .eq("organization_id", organizationId);

      if (txData) {
        const totalRevenue = txData.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const matchedRefcodes = new Set((attrData || []).map(a => a.refcode?.toLowerCase()).filter(Boolean));
        
        const matchedRevenue = txData
          .filter(tx => tx.refcode && matchedRefcodes.has(tx.refcode.toLowerCase()))
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);

        setStats({
          totalRevenue,
          matchedRevenue,
          unmatchedRevenue: totalRevenue - matchedRevenue,
          matchRate: totalRevenue > 0 ? (matchedRevenue / totalRevenue) * 100 : 0,
        });
      }

      // Find unmatched refcodes for suggestions
      await loadSuggestedMatches();
    } catch (error) {
      console.error("Error loading attributions:", error);
      toast.error("Failed to load attribution data");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuggestedMatches = async () => {
    if (!organizationId) return;

    try {
      // Get refcodes not yet in campaign_attribution
      const { data: unmatchedData } = await supabase
        .from("actblue_transactions")
        .select("refcode, amount")
        .eq("organization_id", organizationId)
        .not("refcode", "is", null);

      if (!unmatchedData) return;

      // Group by refcode
      const refcodeStats = unmatchedData.reduce((acc, tx) => {
        const code = tx.refcode?.toLowerCase() || "";
        if (!code) return acc;
        
        if (!acc[code]) {
          acc[code] = { revenue: 0, transactions: 0 };
        }
        acc[code].revenue += tx.amount || 0;
        acc[code].transactions += 1;
        return acc;
      }, {} as Record<string, { revenue: number; transactions: number }>);

      // Get existing attributions to filter out
      const { data: existingAttr } = await supabase
        .from("campaign_attribution")
        .select("refcode")
        .eq("organization_id", organizationId);

      const existingRefcodes = new Set((existingAttr || []).map(a => a.refcode?.toLowerCase()).filter(Boolean));

      // Create suggestions for unmatched refcodes with significant revenue
      const suggestions: SuggestedMatch[] = Object.entries(refcodeStats)
        .filter(([code]) => !existingRefcodes.has(code))
        .filter(([_, stats]) => stats.revenue > 100) // Only suggest refcodes with >$100 revenue
        .map(([code, stats]) => ({
          refcode: code,
          revenue: stats.revenue,
          transactions: stats.transactions,
          suggested_campaign: inferCampaign(code),
          confidence: calculateConfidence(code),
          reason: generateReason(code),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setSuggestedMatches(suggestions);
    } catch (error) {
      console.error("Error loading suggestions:", error);
    }
  };

  const inferCampaign = (refcode: string): string => {
    const code = refcode.toLowerCase();
    if (code.includes("meta") || code.includes("fb") || code.includes("facebook")) {
      return "Meta Ads Campaign";
    }
    if (code.includes("sms") || code.includes("text")) {
      return "SMS Campaign";
    }
    if (code.includes("email") || code.includes("em_")) {
      return "Email Campaign";
    }
    return "Unknown Source";
  };

  const calculateConfidence = (refcode: string): number => {
    const code = refcode.toLowerCase();
    // Higher confidence for clearly labeled refcodes
    if (code.includes("meta_") || code.includes("fb_") || code.includes("sms_")) {
      return 85;
    }
    if (code.includes("utm") || code.includes("campaign")) {
      return 70;
    }
    return 50;
  };

  const generateReason = (refcode: string): string => {
    const code = refcode.toLowerCase();
    if (code.includes("meta") || code.includes("fb")) {
      return "Refcode contains Meta/Facebook identifier";
    }
    if (code.includes("sms")) {
      return "Refcode indicates SMS channel";
    }
    return "Pattern-based suggestion";
  };

  const runAutoMatcher = async () => {
    setIsRunningMatcher(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-match-attribution", {
        body: { organizationId },
      });

      if (error) throw error;

      toast.success(`Found ${data?.matchesCreated || 0} new matches`);
      await loadAttributions();
    } catch (error) {
      console.error("Error running auto-matcher:", error);
      toast.error("Failed to run auto-matcher");
    } finally {
      setIsRunningMatcher(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Match type badge - reframed from "confidence %" to match type labels
  const getMatchTypeBadge = (confidence: number | null, isAutoMatched: boolean | null) => {
    if (!confidence) return <Badge variant="outline">Unmatched</Badge>;
    if (confidence >= 80) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Refcode Match</Badge>;
    if (confidence >= 60) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pattern Match</Badge>;
    if (isAutoMatched) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Timing Correlation</Badge>;
    return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Directional</Badge>;
  };

  return (
    <ClientLayout>
      <V3PageContainer
        icon={GitBranch}
        title="Attribution Tracking"
        description="Track which campaigns drive donations and optimize your ROAS"
        actions={
          <Button
            onClick={runAutoMatcher}
            disabled={isRunningMatcher}
            className="gap-2"
          >
            {isRunningMatcher ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Run Smart Matcher
          </Button>
        }
      >
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <V3KPICard
            label="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            isLoading={isLoading}
          />
          <V3KPICard
            label="Attributed"
            value={formatCurrency(stats.matchedRevenue)}
            icon={CheckCircle}
            trend={stats.matchedRevenue > 0 ? { value: stats.matchRate, isPositive: true } : undefined}
            isLoading={isLoading}
            accent="green"
          />
          <V3KPICard
            label="Unattributed"
            value={formatCurrency(stats.unmatchedRevenue)}
            icon={AlertCircle}
            isLoading={isLoading}
            accent="amber"
          />
          <V3KPICard
            label="Match Rate"
            value={`${stats.matchRate.toFixed(1)}%`}
            icon={TrendingUp}
            isLoading={isLoading}
            accent="blue"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="matched" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="matched">Matched ({attributions.length})</TabsTrigger>
            <TabsTrigger value="suggestions">
              Suggestions ({suggestedMatches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matched">
            <V3Card title="Campaign Attribution Mappings" subtitle="Active mappings connecting refcodes to campaigns">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : attributions.length === 0 ? (
                <V3EmptyState
                  icon={GitBranch}
                  title="No attribution mappings yet"
                  description="Run the Smart Matcher to create mappings automatically"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Refcode</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attributions.map((attr) => (
                      <TableRow key={attr.id}>
                        <TableCell className="font-mono text-sm">
                          {attr.refcode || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {attr.utm_source || attr.meta_campaign_id || "Direct"}
                            {attr.is_auto_matched && (
                              <Badge variant="outline" className="text-xs">
                                Auto
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getMatchTypeBadge(attr.match_confidence, attr.is_auto_matched)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(attr.attributed_revenue || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {attr.attributed_transactions || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </V3Card>
          </TabsContent>

          <TabsContent value="suggestions">
            <V3Card title="Suggested Matches" subtitle="Unmatched refcodes that could be attributed to campaigns">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : suggestedMatches.length === 0 ? (
                <V3EmptyState
                  icon={CheckCircle}
                  title="All matched!"
                  description="All significant refcodes have been matched"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Refcode</TableHead>
                      <TableHead>Suggested Campaign</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestedMatches.map((match) => (
                      <TableRow key={match.refcode}>
                        <TableCell className="font-mono text-sm">
                          {match.refcode}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                            {match.suggested_campaign}
                          </div>
                          <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                            {match.reason}
                          </p>
                        </TableCell>
                        <TableCell>{getMatchTypeBadge(match.confidence, true)}</TableCell>
                        <TableCell className="text-right font-medium text-green-500">
                          {formatCurrency(match.revenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {match.transactions}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </V3Card>
          </TabsContent>
        </Tabs>
      </V3PageContainer>
    </ClientLayout>
  );
};

export default ClientAttribution;
