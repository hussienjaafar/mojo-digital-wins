import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Check, X, AlertTriangle, RefreshCw, Link2, DollarSign, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchResult {
  refcode: string;
  organization_id: string;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  confidence: number;
  reason: string;
  revenue: number;
  transactions: number;
}

interface UnmatchedRefcode {
  refcode: string;
  organization_id: string;
  revenue: number;
  transactions: number;
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
}

const AttributionMatcher = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedRefcode[]>([]);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [rejectedMatches, setRejectedMatches] = useState<Set<string>>(new Set());

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

  const runAutoMatch = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-match-attribution', {
        body: { dryRun: true, minConfidence: 0.5 }
      });

      if (error) throw error;

      setMatches(data.matches || []);
      setUnmatched(data.unmatched || []);
      setSummary(data.summary || null);
      
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
        description: `Found ${data.summary?.totalMatched || 0} potential matches`,
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
              Automatically match ActBlue refcodes to Meta campaigns with confidence scores
            </CardDescription>
          </div>
          <Button onClick={runAutoMatch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Run Auto-Match
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        {summary && (
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
                <Button 
                  onClick={applySelectedMatches} 
                  disabled={selectedMatches.size === 0 || isApplying}
                  size="sm"
                >
                  {isApplying ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Apply Selected ({selectedMatches.size})
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Refcode</TableHead>
                    <TableHead>Meta Campaign</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Txns</TableHead>
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
                          </div>
                        </TableCell>
                        <TableCell>{getConfidenceBadge(match.confidence)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {match.reason}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(match.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {match.transactions}
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
                (Requires manual mapping)
              </span>
            </h3>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Refcode</TableHead>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttributionMatcher;
