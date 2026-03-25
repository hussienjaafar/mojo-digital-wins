import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Database, Play } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ValidationResult {
  org_id: string;
  org_name: string;
  date: string;
  raw_donations: number;
  raw_gross: number;
  agg_donations: number | null;
  agg_funds: number | null;
  donation_diff: number;
  amount_diff: number;
  status: 'match' | 'mismatch' | 'missing';
}

interface OrgSummary {
  org_id: string;
  org_name: string;
  total_transactions: number;
  gross_raised: number;
  earliest_date: string;
  latest_date: string;
  entity_ids: string[];
  has_data_split: boolean;
}

export function ActBlueDataValidator() {
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [orgSummaries, setOrgSummaries] = useState<OrgSummary[]>([]);
  const [lastValidated, setLastValidated] = useState<Date | null>(null);

  const runValidation = async () => {
    setLoading(true);
    try {
      // Get all active organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('client_organizations')
        .select('id, name')
        .eq('is_active', true);

      if (orgsError) throw orgsError;

      const summaries: OrgSummary[] = [];
      const results: ValidationResult[] = [];

      for (const org of orgs || []) {
        // Get transaction summary for this org
        const { data: txSummary } = await (supabase as any)
          .from('actblue_transactions')
          .select('entity_id, amount, transaction_date')
          .eq('organization_id', org.id);

        if (!txSummary || txSummary.length === 0) continue;

        const entityIds = [...new Set(txSummary.map((t: any) => t.entity_id).filter(Boolean))];
        const totalTransactions = txSummary.length;
        const grossRaised = txSummary.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        const dates = txSummary.map((t: any) => t.transaction_date).filter(Boolean).sort();

        summaries.push({
          org_id: org.id,
          org_name: org.name,
          total_transactions: totalTransactions,
          gross_raised: grossRaised,
          earliest_date: dates[0] || 'N/A',
          latest_date: dates[dates.length - 1] || 'N/A',
          entity_ids: entityIds as string[],
          has_data_split: entityIds.length > 1
        });

        // Compare last 7 days raw vs aggregated for each org
        const today = new Date();
        for (let i = 0; i < 7; i++) {
          const checkDate = format(subDays(today, i), 'yyyy-MM-dd');

          // Get raw transaction data for this date
          const { data: rawData } = await (supabase as any)
            .from('actblue_transactions')
            .select('amount')
            .eq('organization_id', org.id)
            .gte('transaction_date', `${checkDate}T00:00:00`)
            .lt('transaction_date', `${checkDate}T23:59:59.999`)
            .gt('amount', 0);

          const rawDonations = rawData?.length || 0;
          const rawGross = rawData?.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0) || 0;

          // Get aggregated data for this date
          const { data: aggData } = await supabase
            .from('daily_aggregated_metrics')
            .select('total_donations, total_funds_raised')
            .eq('organization_id', org.id)
            .eq('date', checkDate)
            .maybeSingle();

          const aggDonations = aggData?.total_donations ?? null;
          const aggFunds = aggData?.total_funds_raised ?? null;

          const donationDiff = aggDonations !== null ? rawDonations - aggDonations : rawDonations;
          const amountDiff = aggFunds !== null ? rawGross - aggFunds : rawGross;

          let status: 'match' | 'mismatch' | 'missing' = 'match';
          if (aggDonations === null || aggFunds === null) {
            status = 'missing';
          } else if (Math.abs(donationDiff) > 0 || Math.abs(amountDiff) > 1) {
            status = 'mismatch';
          }

          // Only include if there's data or a mismatch
          if (rawDonations > 0 || aggDonations !== null) {
            results.push({
              org_id: org.id,
              org_name: org.name,
              date: checkDate,
              raw_donations: rawDonations,
              raw_gross: rawGross,
              agg_donations: aggDonations,
              agg_funds: aggFunds,
              donation_diff: donationDiff,
              amount_diff: amountDiff,
              status
            });
          }
        }
      }

      setOrgSummaries(summaries);
      setValidationResults(results);
      setLastValidated(new Date());

      const mismatches = results.filter(r => r.status === 'mismatch').length;
      const missing = results.filter(r => r.status === 'missing').length;

      if (mismatches > 0 || missing > 0) {
        toast.warning(`Validation found ${mismatches} mismatches and ${missing} missing records`);
      } else {
        toast.success('All data matches!');
      }

    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(`Validation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runBackfill = async (orgId?: string) => {
    setBackfilling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Authentication required');
        return;
      }

      const response = await supabase.functions.invoke('backfill-daily-metrics', {
        body: orgId 
          ? { organization_id: orgId, start_date: format(subDays(new Date(), 30), 'yyyy-MM-dd') }
          : { all_orgs: true, start_date: format(subDays(new Date(), 30), 'yyyy-MM-dd') }
      });

      if (response.error) throw response.error;

      const result = response.data;
      toast.success(`Backfill complete: ${result.total_dates_processed} dates processed across ${result.organizations_processed} org(s)`);
      
      // Re-run validation
      await runValidation();

    } catch (error: any) {
      console.error('Backfill error:', error);
      toast.error(`Backfill failed: ${error.message}`);
    } finally {
      setBackfilling(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: 'match' | 'mismatch' | 'missing') => {
    switch (status) {
      case 'match':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Match</Badge>;
      case 'mismatch':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Mismatch</Badge>;
      case 'missing':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Missing</Badge>;
    }
  };

  const mismatches = validationResults.filter(r => r.status !== 'match');
  const orgsWithSplit = orgSummaries.filter(o => o.has_data_split);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">ActBlue Data Validator</h3>
          <p className="text-sm text-muted-foreground">
            Compare raw transaction data vs aggregated metrics
            {lastValidated && ` • Last validated: ${format(lastValidated, 'MMM d, h:mm a')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => runValidation()}
            disabled={loading || backfilling}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Validate Data
          </Button>
          <Button
            onClick={() => runBackfill()}
            disabled={loading || backfilling}
          >
            {backfilling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Backfill All Orgs (30d)
          </Button>
        </div>
      </div>

      {/* Data Split Warning */}
      {orgsWithSplit.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Organizations with Multiple Entity IDs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              These organizations have transactions from multiple ActBlue entity IDs, which may indicate data was previously split across orgs:
            </p>
            <div className="space-y-2">
              {orgsWithSplit.map((org) => (
                <div key={org.org_id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{org.org_name}</span>
                  <span className="text-muted-foreground">Entity IDs: {org.entity_ids.join(', ')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organization Summary */}
      {orgSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="w-4 h-4" />
              Organization Data Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">Organization</th>
                    <th className="text-right py-2">Transactions</th>
                    <th className="text-right py-2">Gross Raised</th>
                    <th className="text-right py-2">Date Range</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgSummaries.map((org) => (
                    <tr key={org.org_id} className="border-b border-border/50">
                      <td className="py-2 font-medium">{org.org_name}</td>
                      <td className="text-right py-2">{org.total_transactions.toLocaleString()}</td>
                      <td className="text-right py-2">{formatCurrency(org.gross_raised)}</td>
                      <td className="text-right py-2 text-muted-foreground text-xs">
                        {org.earliest_date.split('T')[0]} → {org.latest_date.split('T')[0]}
                      </td>
                      <td className="text-right py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => runBackfill(org.org_id)}
                          disabled={backfilling}
                        >
                          {backfilling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Backfill'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Validation Results (Last 7 Days)
              {mismatches.length > 0 && (
                <Badge variant="destructive" className="ml-2">{mismatches.length} issues</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b sticky top-0 bg-background">
                  <tr>
                    <th className="text-left py-2">Organization</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-right py-2">Raw Donations</th>
                    <th className="text-right py-2">Agg Donations</th>
                    <th className="text-right py-2">Raw Gross</th>
                    <th className="text-right py-2">Agg Funds</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResults
                    .sort((a, b) => {
                      // Sort mismatches first, then by date desc
                      if (a.status !== 'match' && b.status === 'match') return -1;
                      if (a.status === 'match' && b.status !== 'match') return 1;
                      return new Date(b.date).getTime() - new Date(a.date).getTime();
                    })
                    .map((result, i) => (
                      <tr key={`${result.org_id}-${result.date}-${i}`} className={`border-b border-border/50 ${result.status !== 'match' ? 'bg-destructive/5' : ''}`}>
                        <td className="py-2 font-medium">{result.org_name}</td>
                        <td className="py-2">{result.date}</td>
                        <td className="text-right py-2">{result.raw_donations}</td>
                        <td className="text-right py-2">
                          {result.agg_donations ?? <span className="text-muted-foreground">—</span>}
                          {result.donation_diff !== 0 && result.agg_donations !== null && (
                            <span className={`ml-1 text-xs ${result.donation_diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              ({result.donation_diff > 0 ? '+' : ''}{result.donation_diff})
                            </span>
                          )}
                        </td>
                        <td className="text-right py-2">{formatCurrency(result.raw_gross)}</td>
                        <td className="text-right py-2">
                          {result.agg_funds !== null ? formatCurrency(result.agg_funds) : <span className="text-muted-foreground">—</span>}
                          {Math.abs(result.amount_diff) > 1 && result.agg_funds !== null && (
                            <span className={`ml-1 text-xs ${result.amount_diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              ({result.amount_diff > 0 ? '+' : ''}{formatCurrency(result.amount_diff)})
                            </span>
                          )}
                        </td>
                        <td className="text-center py-2">{getStatusBadge(result.status)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && validationResults.length === 0 && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Database className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Validation Data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click "Validate Data" to compare raw ActBlue transactions with aggregated metrics
            </p>
            <Button onClick={() => runValidation()} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Run Validation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
