import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ClientLayout } from "@/components/client/ClientLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { GitBranch, DollarSign, TrendingUp, AlertCircle, CheckCircle, Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const getConfidenceBadge = (confidence: number | null) => {
    if (!confidence) return <Badge variant="outline">Unknown</Badge>;
    if (confidence >= 80) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">High ({confidence}%)</Badge>;
    if (confidence >= 60) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium ({confidence}%)</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Low ({confidence}%)</Badge>;
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight portal-text-primary flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-secondary" />
              Attribution Tracking
            </h1>
            <p className="text-sm portal-text-secondary">
              Track which campaigns drive donations and optimize your ROAS
            </p>
          </div>
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
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="portal-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <DollarSign className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm portal-text-secondary">Total Revenue</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className="text-xl font-bold portal-text-primary">
                      {formatCurrency(stats.totalRevenue)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="portal-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm portal-text-secondary">Attributed</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className="text-xl font-bold text-green-500">
                      {formatCurrency(stats.matchedRevenue)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="portal-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm portal-text-secondary">Unattributed</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className="text-xl font-bold text-amber-500">
                      {formatCurrency(stats.unmatchedRevenue)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="portal-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm portal-text-secondary">Match Rate</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <p className="text-xl font-bold text-blue-500">
                      {stats.matchRate.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
            <Card className="portal-card">
              <CardHeader>
                <CardTitle>Campaign Attribution Mappings</CardTitle>
                <CardDescription>
                  Active mappings connecting refcodes to campaigns
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : attributions.length === 0 ? (
                  <div className="text-center py-8 portal-text-secondary">
                    <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <p>No attribution mappings yet</p>
                    <p className="text-sm mt-1">Run the Smart Matcher to create mappings automatically</p>
                  </div>
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
                          <TableCell>{getConfidenceBadge(attr.match_confidence)}</TableCell>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggestions">
            <Card className="portal-card">
              <CardHeader>
                <CardTitle>Suggested Matches</CardTitle>
                <CardDescription>
                  Unmatched refcodes that could be attributed to campaigns
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : suggestedMatches.length === 0 ? (
                  <div className="text-center py-8 portal-text-secondary">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-60" />
                    <p>All significant refcodes have been matched!</p>
                  </div>
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
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              {match.suggested_campaign}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {match.reason}
                            </p>
                          </TableCell>
                          <TableCell>{getConfidenceBadge(match.confidence)}</TableCell>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ClientLayout>
  );
};

export default ClientAttribution;
