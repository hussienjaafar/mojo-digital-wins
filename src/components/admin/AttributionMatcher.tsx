import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { V3Button } from "@/components/v3/V3Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Check, X, AlertTriangle, RefreshCw, Link2, DollarSign, Loader2, ExternalLink, Info, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MatchResult {
  refcode: string;
  organization_id: string;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  confidence: number;
  reason: string;
  revenue: number;
  transactions: number;
  destination_url?: string;
  match_type: 'url_exact' | 'url_pattern' | 'campaign_pattern' | 'fuzzy' | 'none';
}

interface UnmatchedRefcode {
  refcode: string;
  organization_id: string;
  revenue: number;
  transactions: number;
  reason: string;
}

interface MatchSummary {
  totalMatched: number;
  totalUnmatched: number;
  created: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  totalMatchedRevenue: number;
  totalUnmatchedRevenue: number;
  urlMatches: number;
  patternMatches: number;
  fuzzyMatches: number;
  noUrlData: number;
}

interface AttributionMatcherProps {
  organizationId?: string;
}

interface DebugInfo {
  timestamp: string;
  dataFetched: {
    transactionCount: number;
    uniqueRefcodes: number;
    creativesWithUrls: number;
    creativesWithRefcodes: number;
    metaCampaigns: number;
  };
  matchingStats: {
    urlMatches: number;
    patternMatches: number;
    fuzzyMatches: number;
    noUrlData: number;
  };
  sampleCreatives: Array<{
    campaign_id: string;
    destination_url: string;
    extracted_refcode: string;
  }>;
}

const AttributionMatcher = ({ organizationId }: AttributionMatcherProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedRefcode[]>([]);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [rejectedMatches, setRejectedMatches] = useState<Set<string>>(new Set());
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Helper to estimate refcode count from matches/unmatched
  const refcodeAggregatesSize = (data: any) => {
    return (data.matches?.length || 0) + (data.unmatched?.length || 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">High ({Math.round(confidence * 100)}%)</Badge>;
    }
    if (confidence >= 0.7) {
      return <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">Medium ({Math.round(confidence * 100)}%)</Badge>;
    }
    return <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  const getMatchTypeBadge = (matchType: string) => {
    switch (matchType) {
      case 'url_exact':
        return <Badge className="bg-primary/20 text-primary border-primary/30">URL Match</Badge>;
      case 'url_pattern':
        return <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30">URL Pattern</Badge>;
      case 'campaign_pattern':
        return <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30">Pattern</Badge>;
      case 'fuzzy':
        return <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30">Fuzzy</Badge>;
      default:
        return null;
    }
  };

  const runAutoMatch = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-match-attribution', {
        body: { dryRun: true, minConfidence: 0.5, organizationId }
      });

      if (error) throw error;

      setMatches(data.matches || []);
      setUnmatched(data.unmatched || []);
      setSummary(data.summary || null);
      
      // Build debug info from response
      setDebugInfo({
        timestamp: new Date().toISOString(),
        dataFetched: {
          transactionCount: data.debugInfo?.transactionCount || 0,
          uniqueRefcodes: data.debugInfo?.uniqueRefcodes || refcodeAggregatesSize(data),
          creativesWithUrls: data.debugInfo?.creativesWithUrls || 0,
          creativesWithRefcodes: data.debugInfo?.creativesWithRefcodes || 0,
          metaCampaigns: data.debugInfo?.metaCampaigns || 0
        },
        matchingStats: {
          urlMatches: data.summary?.urlMatches || 0,
          patternMatches: data.summary?.patternMatches || 0,
          fuzzyMatches: data.summary?.fuzzyMatches || 0,
          noUrlData: data.summary?.noUrlData || 0
        },
        sampleCreatives: data.debugInfo?.sampleCreatives || []
      });
      
      // Pre-select high confidence matches
      const preSelected = new Set<string>();
      for (const match of data.matches || []) {
        if (match.confidence >= 0.8) {
          preSelected.add(`${match.organization_id}:${match.refcode}`);
        }
      }
      setSelectedMatches(preSelected);
      setRejectedMatches(new Set());

      toast({
        title: "Auto-match complete",
        description: `Found ${data.summary?.totalMatched || 0} potential matches (${data.summary?.urlMatches || 0} from URLs)`,
      });
    } catch (error: any) {
      console.error('Auto-match error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to run auto-match",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMatch = (match: MatchResult) => {
    const key = `${match.organization_id}:${match.refcode}`;
    const newSelected = new Set(selectedMatches);
    const newRejected = new Set(rejectedMatches);

    if (selectedMatches.has(key)) {
      newSelected.delete(key);
      newRejected.add(key);
    } else if (rejectedMatches.has(key)) {
      newRejected.delete(key);
    } else {
      newSelected.add(key);
    }

    setSelectedMatches(newSelected);
    setRejectedMatches(newRejected);
  };

  const applySelectedMatches = async () => {
    const matchesToApply = matches.filter(m => 
      selectedMatches.has(`${m.organization_id}:${m.refcode}`)
    );

    if (matchesToApply.length === 0) {
      toast({
        title: "No matches selected",
        description: "Please select at least one match to apply",
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);
    try {
      // Insert the selected attributions
      const insertData = matchesToApply.map(m => ({
        organization_id: m.organization_id,
        refcode: m.refcode,
        meta_campaign_id: m.meta_campaign_id,
        utm_source: 'facebook',
        match_confidence: m.confidence,
        is_auto_matched: true,
        match_reason: m.reason,
        last_matched_at: new Date().toISOString(),
        attributed_revenue: m.revenue,
        attributed_transactions: m.transactions
      }));

      const { error } = await (supabase as any)
        .from('campaign_attribution')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Attributions created",
        description: `Successfully created ${matchesToApply.length} attribution mappings`,
      });

      // Clear applied matches from the list
      setMatches(matches.filter(m => 
        !selectedMatches.has(`${m.organization_id}:${m.refcode}`)
      ));
      setSelectedMatches(new Set());

    } catch (error: any) {
      console.error('Apply matches error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to apply matches",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Smart Attribution Matcher
            </CardTitle>
            <CardDescription>
              Automatically match ActBlue refcodes to Meta campaigns using destination URLs and pattern matching
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <V3Button 
              variant="secondary" 
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="mr-2"
            >
              <Bug className="w-4 h-4 mr-1" />
              {showDebug ? 'Hide Debug' : 'Debug'}
            </V3Button>
            <V3Button onClick={runAutoMatch} isLoading={isLoading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Run Auto-Match
            </V3Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        {summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">High Confidence</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground">{summary.highConfidence}</div>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Medium Confidence</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground">{summary.mediumConfidence}</div>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 text-primary">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Matched Revenue</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(summary.totalMatchedRevenue)}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted border border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <X className="w-4 h-4" />
                  <span className="text-sm font-medium">Unmatched</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground">{summary.totalUnmatched}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(summary.totalUnmatchedRevenue)} revenue</div>
              </div>
            </div>

            {/* Match Type Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">URL Matches</span>
                </div>
                <div className="mt-1 text-xl font-bold text-foreground">{summary.urlMatches}</div>
                <div className="text-xs text-muted-foreground">From destination URLs</div>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                  <span className="text-sm font-medium">Pattern Matches</span>
                </div>
                <div className="mt-1 text-xl font-bold text-foreground">{summary.patternMatches}</div>
                <div className="text-xs text-muted-foreground">Campaign name patterns</div>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <span className="text-sm font-medium">Fuzzy Matches</span>
                </div>
                <div className="mt-1 text-xl font-bold text-foreground">{summary.fuzzyMatches}</div>
                <div className="text-xs text-muted-foreground">Similarity-based</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 cursor-help">
                        <Info className="w-4 h-4" />
                        <span className="text-sm font-medium">Missing URL Data</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Refcodes that couldn't be matched because Meta ads don't have destination URLs with refcode parameters. Sync Meta ads to extract refcodes.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="mt-1 text-xl font-bold text-foreground">{summary.noUrlData}</div>
                <div className="text-xs text-muted-foreground">No refcodes in ads</div>
              </div>
            </div>
          </div>
        )}

        {/* Suggested Matches Table */}
        {matches.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Suggested Matches</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedMatches.size} selected
                </span>
                <V3Button 
                  onClick={applySelectedMatches} 
                  disabled={selectedMatches.size === 0}
                  isLoading={isApplying}
                  size="sm"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Apply Selected ({selectedMatches.size})
                </V3Button>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Refcode</TableHead>
                    <TableHead>Meta Campaign</TableHead>
                    <TableHead>Match Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => {
                    const key = `${match.organization_id}:${match.refcode}`;
                    const isSelected = selectedMatches.has(key);
                    const isRejected = rejectedMatches.has(key);

                    return (
                      <TableRow 
                        key={key}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected && "bg-green-500/10",
                          isRejected && "bg-red-500/10 opacity-60"
                        )}
                        onClick={() => toggleMatch(match)}
                      >
                        <TableCell>
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          ) : isRejected ? (
                            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                              <X className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {match.refcode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{match.meta_campaign_name || match.meta_campaign_id}</span>
                            {match.destination_url && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a 
                                      href={match.destination_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-muted-foreground hover:text-primary"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs break-all">{match.destination_url}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getMatchTypeBadge(match.match_type)}</TableCell>
                        <TableCell>{getConfidenceBadge(match.confidence)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {match.reason}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(match.revenue)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Unmatched Refcodes */}
        {unmatched.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Unmatched Refcodes
              <span className="text-sm font-normal text-muted-foreground">
                (Requires manual mapping or Meta ads sync)
              </span>
            </h3>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Refcode</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatched.slice(0, 10).map((item) => (
                    <TableRow key={`${item.organization_id}:${item.refcode}`}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {item.refcode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs">
                        {item.reason}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.transactions}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {unmatched.length > 10 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t border-border">
                  And {unmatched.length - 10} more unmatched refcodes...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {matches.length === 0 && unmatched.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Wand2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Auto-Match" to find potential attribution mappings</p>
            <p className="text-sm mt-2">The matcher will first try to match refcodes from Meta ad destination URLs, then fall back to pattern matching</p>
          </div>
        )}

        {/* Debug Panel */}
        {showDebug && debugInfo && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <Bug className="w-4 h-4" />
              Debug Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-muted-foreground mb-2">Data Fetched</h5>
                <ul className="space-y-1 font-mono text-xs">
                  <li>Transactions: {debugInfo.dataFetched.transactionCount}</li>
                  <li>Unique Refcodes: {debugInfo.dataFetched.uniqueRefcodes}</li>
                  <li>Creatives with URLs: {debugInfo.dataFetched.creativesWithUrls}</li>
                  <li className={debugInfo.dataFetched.creativesWithRefcodes === 0 ? "text-red-500 font-bold" : ""}>
                    Creatives with Refcodes: {debugInfo.dataFetched.creativesWithRefcodes}
                    {debugInfo.dataFetched.creativesWithRefcodes === 0 && " ⚠️ No refcodes extracted!"}
                  </li>
                  <li>Meta Campaigns: {debugInfo.dataFetched.metaCampaigns}</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-muted-foreground mb-2">Matching Stats</h5>
                <ul className="space-y-1 font-mono text-xs">
                  <li className="text-green-600">URL Matches: {debugInfo.matchingStats.urlMatches}</li>
                  <li className="text-purple-600">Pattern Matches: {debugInfo.matchingStats.patternMatches}</li>
                  <li className="text-orange-600">Fuzzy Matches: {debugInfo.matchingStats.fuzzyMatches}</li>
                  <li className={debugInfo.matchingStats.noUrlData > 0 ? "text-red-500" : ""}>
                    No URL Data: {debugInfo.matchingStats.noUrlData}
                  </li>
                </ul>
              </div>
            </div>
            
            {debugInfo.sampleCreatives && debugInfo.sampleCreatives.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium text-muted-foreground mb-2">Sample Meta Ad Creatives</h5>
                <div className="rounded border border-border overflow-hidden">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Campaign ID</th>
                        <th className="p-2 text-left">Destination URL</th>
                        <th className="p-2 text-left">Extracted Refcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debugInfo.sampleCreatives.map((c, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-2">{c.campaign_id.substring(0, 20)}...</td>
                          <td className="p-2 max-w-xs truncate">{c.destination_url}</td>
                          <td className={`p-2 ${c.extracted_refcode === 'NONE' ? 'text-red-500' : 'text-green-600 font-bold'}`}>
                            {c.extracted_refcode}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {debugInfo.sampleCreatives?.length === 0 && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-700 dark:text-red-400 text-sm">
                <strong>⚠️ No creatives with destination URLs found!</strong>
                <p className="mt-1">This means the Meta ads sync is not extracting destination URLs. Check edge function logs for "sync-meta-ads" to debug.</p>
              </div>
            )}
            
            <div className="mt-4 text-xs text-muted-foreground">
              Last run: {new Date(debugInfo.timestamp).toLocaleString()}
            </div>
          </div>
        )}
        
        {showDebug && !debugInfo && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border text-center text-muted-foreground">
            <Bug className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Run Auto-Match to see debug information</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttributionMatcher;
