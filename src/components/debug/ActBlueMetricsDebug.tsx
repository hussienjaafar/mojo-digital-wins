/**
 * ActBlue Metrics Debug Panel
 *
 * Dev-only utility for validating ActBlue metrics correctness.
 * Shows raw transaction breakdowns and compares with dashboard computed values.
 *
 * Enable by adding ?debug=actblue to URL or setting VITE_ENABLE_METRICS_DEBUG=true
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

interface DebugMetrics {
  // Raw transaction metrics
  rawGrossDonations: number;
  rawNetDonations: number;
  rawTotalFees: number;
  rawRefunds: number;
  rawNetRevenue: number;
  rawDonationCount: number;
  rawUniqueDonors: number;

  // Daily breakdown
  dailyBreakdown: Array<{
    day: string;
    dayUtc: string;
    dayLocal: string;
    donationCount: number;
    grossDonations: number;
    netDonations: number;
    refunds: number;
    netRevenue: number;
    shiftsDay: boolean;
  }>;

  // Duplicate detection
  duplicates: Array<{
    transactionId: string;
    count: number;
  }>;

  // Timezone shift transactions
  timezoneShiftTxs: Array<{
    transactionId: string;
    amount: number;
    dateUtc: string;
    dayUtc: string;
    dayLocal: string;
  }>;
}

interface ActBlueMetricsDebugProps {
  organizationId: string;
  startDate: string;
  endDate: string;
  dashboardKpis?: {
    totalRaised: number;
    totalNetRevenue: number;
    totalFees: number;
    refundAmount: number;
    donationCount: number;
    uniqueDonors: number;
  };
  timezone?: string;
}

// Default timezone for ActBlue-focused orgs
const DEFAULT_TIMEZONE = 'America/New_York';

async function fetchDebugMetrics(
  organizationId: string,
  startDate: string,
  endDate: string,
  timezone: string
): Promise<DebugMetrics> {
  // Fetch all transactions for the period
  const { data: transactions, error } = await (supabase as any)
    .from('actblue_transactions_secure')
    .select('id, transaction_id, amount, net_amount, fee, transaction_type, transaction_date, donor_email')
    .eq('organization_id', organizationId)
    .gte('transaction_date', startDate)
    .lt('transaction_date', format(new Date(new Date(endDate).getTime() + 86400000), 'yyyy-MM-dd'));

  if (error) throw error;

  const txs = transactions || [];

  // Separate donations and refunds
  const donations = txs.filter((t: any) => t.transaction_type === 'donation');
  const refunds = txs.filter((t: any) => t.transaction_type === 'refund' || t.transaction_type === 'cancellation');

  // Calculate raw metrics
  const rawGrossDonations = donations.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const rawTotalFees = donations.reduce((sum: number, t: any) => sum + Number(t.fee || 0), 0);
  const rawNetDonations = donations.reduce((sum: number, t: any) => sum + Number(t.net_amount ?? (t.amount - (t.fee || 0))), 0);
  const rawRefunds = refunds.reduce((sum: number, t: any) => sum + Math.abs(Number(t.net_amount ?? t.amount ?? 0)), 0);
  const rawNetRevenue = rawNetDonations - rawRefunds;
  const rawDonationCount = donations.length;
  const rawUniqueDonors = new Set(donations.map((t: any) => t.donor_email).filter(Boolean)).size;

  // Group by day (both UTC and local timezone) for comparison
  const dailyMap = new Map<string, {
    dayUtc: string;
    dayLocal: string;
    donationCount: number;
    grossDonations: number;
    netDonations: number;
    refunds: number;
    shiftsDay: boolean;
  }>();

  for (const tx of txs) {
    const txDate = new Date(tx.transaction_date);
    const dayUtc = format(txDate, 'yyyy-MM-dd');

    // Calculate local day using timezone
    let dayLocal: string;
    try {
      dayLocal = formatInTimeZone(txDate, timezone, 'yyyy-MM-dd');
    } catch {
      dayLocal = dayUtc; // Fallback if timezone is invalid
    }

    const shiftsDay = dayUtc !== dayLocal;
    const key = dayLocal; // Use local day as key

    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        dayUtc,
        dayLocal,
        donationCount: 0,
        grossDonations: 0,
        netDonations: 0,
        refunds: 0,
        shiftsDay: false,
      });
    }

    const entry = dailyMap.get(key)!;
    if (shiftsDay) entry.shiftsDay = true;

    if (tx.transaction_type === 'donation') {
      entry.donationCount++;
      entry.grossDonations += Number(tx.amount || 0);
      entry.netDonations += Number(tx.net_amount ?? (tx.amount - (tx.fee || 0)));
    } else if (tx.transaction_type === 'refund' || tx.transaction_type === 'cancellation') {
      entry.refunds += Math.abs(Number(tx.net_amount ?? tx.amount ?? 0));
    }
  }

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([day, data]) => ({
      day,
      ...data,
      netRevenue: data.netDonations - data.refunds,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // Detect duplicates by transaction_id
  const txIdCounts = new Map<string, number>();
  for (const tx of txs) {
    const count = txIdCounts.get(tx.transaction_id) || 0;
    txIdCounts.set(tx.transaction_id, count + 1);
  }
  const duplicates = Array.from(txIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([transactionId, count]) => ({ transactionId, count }));

  // Find transactions that shift between UTC and local day
  const timezoneShiftTxs = txs
    .filter((tx: any) => {
      const txDate = new Date(tx.transaction_date);
      const dayUtc = format(txDate, 'yyyy-MM-dd');
      let dayLocal: string;
      try {
        dayLocal = formatInTimeZone(txDate, timezone, 'yyyy-MM-dd');
      } catch {
        dayLocal = dayUtc;
      }
      return dayUtc !== dayLocal;
    })
    .map((tx: any) => {
      const txDate = new Date(tx.transaction_date);
      const dayUtc = format(txDate, 'yyyy-MM-dd');
      let dayLocal: string;
      try {
        dayLocal = formatInTimeZone(txDate, timezone, 'yyyy-MM-dd');
      } catch {
        dayLocal = dayUtc;
      }
      return {
        transactionId: tx.transaction_id,
        amount: tx.amount,
        dateUtc: tx.transaction_date,
        dayUtc,
        dayLocal,
      };
    });

  return {
    rawGrossDonations,
    rawNetDonations,
    rawTotalFees,
    rawRefunds,
    rawNetRevenue,
    rawDonationCount,
    rawUniqueDonors,
    dailyBreakdown,
    duplicates,
    timezoneShiftTxs,
  };
}

export function ActBlueMetricsDebug({
  organizationId,
  startDate,
  endDate,
  dashboardKpis,
  timezone = DEFAULT_TIMEZONE,
}: ActBlueMetricsDebugProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: debugMetrics, isLoading, error } = useQuery({
    queryKey: ['debug', 'actblue-metrics', organizationId, startDate, endDate, timezone],
    queryFn: () => fetchDebugMetrics(organizationId, startDate, endDate, timezone),
    enabled: !!organizationId && expanded,
    staleTime: 30000,
  });

  // Check if debug is enabled via URL or env
  const isDebugEnabled =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('debug') === 'actblue' ||
     import.meta.env.VITE_ENABLE_METRICS_DEBUG === 'true');

  if (!isDebugEnabled) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatDelta = (raw: number, dashboard: number | undefined) => {
    if (dashboard === undefined) return 'N/A';
    const delta = raw - dashboard;
    if (Math.abs(delta) < 0.01) return '✓ Match';
    const pct = dashboard !== 0 ? ((delta / dashboard) * 100).toFixed(1) : 'N/A';
    return `${delta > 0 ? '+' : ''}${formatCurrency(delta)} (${pct}%)`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg font-mono text-xs font-bold shadow-lg hover:bg-yellow-400"
      >
        {expanded ? '▼ Close Debug' : '▲ ActBlue Debug'}
      </button>

      {expanded && (
        <div className="mt-2 bg-gray-900 text-green-400 p-4 rounded-lg shadow-xl font-mono text-xs max-h-[70vh] overflow-auto border border-yellow-500">
          <div className="text-yellow-500 font-bold mb-2">
            ActBlue Metrics Reconciliation
          </div>
          <div className="text-gray-400 mb-3">
            Org: {organizationId.slice(0, 8)}... | Range: {startDate} to {endDate} | TZ: {timezone}
          </div>

          {isLoading && <div>Loading debug data...</div>}
          {error && <div className="text-red-400">Error: {String(error)}</div>}

          {debugMetrics && (
            <>
              {/* Summary Comparison */}
              <div className="mb-4 p-2 bg-gray-800 rounded">
                <div className="text-yellow-400 font-bold mb-1">Period Summary Comparison</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-500">
                      <th>Metric</th>
                      <th>Raw TX</th>
                      <th>Dashboard</th>
                      <th>Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Gross Raised</td>
                      <td>{formatCurrency(debugMetrics.rawGrossDonations)}</td>
                      <td>{dashboardKpis ? formatCurrency(dashboardKpis.totalRaised) : 'N/A'}</td>
                      <td className={
                        dashboardKpis && Math.abs(debugMetrics.rawGrossDonations - dashboardKpis.totalRaised) > 0.01
                          ? 'text-red-400' : 'text-green-400'
                      }>
                        {formatDelta(debugMetrics.rawGrossDonations, dashboardKpis?.totalRaised)}
                      </td>
                    </tr>
                    <tr>
                      <td>Net Revenue</td>
                      <td>{formatCurrency(debugMetrics.rawNetRevenue)}</td>
                      <td>{dashboardKpis ? formatCurrency(dashboardKpis.totalNetRevenue) : 'N/A'}</td>
                      <td className={
                        dashboardKpis && Math.abs(debugMetrics.rawNetRevenue - dashboardKpis.totalNetRevenue) > 0.01
                          ? 'text-red-400' : 'text-green-400'
                      }>
                        {formatDelta(debugMetrics.rawNetRevenue, dashboardKpis?.totalNetRevenue)}
                      </td>
                    </tr>
                    <tr>
                      <td>Total Fees</td>
                      <td>{formatCurrency(debugMetrics.rawTotalFees)}</td>
                      <td>{dashboardKpis ? formatCurrency(dashboardKpis.totalFees) : 'N/A'}</td>
                      <td className={
                        dashboardKpis && Math.abs(debugMetrics.rawTotalFees - dashboardKpis.totalFees) > 0.01
                          ? 'text-red-400' : 'text-green-400'
                      }>
                        {formatDelta(debugMetrics.rawTotalFees, dashboardKpis?.totalFees)}
                      </td>
                    </tr>
                    <tr>
                      <td>Total Refunds</td>
                      <td>{formatCurrency(debugMetrics.rawRefunds)}</td>
                      <td>{dashboardKpis ? formatCurrency(dashboardKpis.refundAmount) : 'N/A'}</td>
                      <td className={
                        dashboardKpis && Math.abs(debugMetrics.rawRefunds - dashboardKpis.refundAmount) > 0.01
                          ? 'text-red-400' : 'text-green-400'
                      }>
                        {formatDelta(debugMetrics.rawRefunds, dashboardKpis?.refundAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td>Donation Count</td>
                      <td>{debugMetrics.rawDonationCount}</td>
                      <td>{dashboardKpis?.donationCount ?? 'N/A'}</td>
                      <td className={
                        dashboardKpis && debugMetrics.rawDonationCount !== dashboardKpis.donationCount
                          ? 'text-red-400' : 'text-green-400'
                      }>
                        {dashboardKpis
                          ? debugMetrics.rawDonationCount - dashboardKpis.donationCount === 0
                            ? '✓ Match'
                            : `${debugMetrics.rawDonationCount - dashboardKpis.donationCount}`
                          : 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Warnings */}
              {(debugMetrics.duplicates.length > 0 || debugMetrics.timezoneShiftTxs.length > 0) && (
                <div className="mb-4 p-2 bg-red-900/30 rounded border border-red-500">
                  <div className="text-red-400 font-bold mb-1">Warnings</div>
                  {debugMetrics.duplicates.length > 0 && (
                    <div className="text-red-300">
                      ⚠️ {debugMetrics.duplicates.length} duplicate transaction_id(s) found
                    </div>
                  )}
                  {debugMetrics.timezoneShiftTxs.length > 0 && (
                    <div className="text-yellow-300">
                      ⏰ {debugMetrics.timezoneShiftTxs.length} transaction(s) shift days between UTC and {timezone}
                    </div>
                  )}
                </div>
              )}

              {/* Daily Breakdown */}
              <div className="mb-4 p-2 bg-gray-800 rounded">
                <div className="text-yellow-400 font-bold mb-1">Daily Breakdown (by {timezone})</div>
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="text-gray-500">
                      <th>Day</th>
                      <th>Count</th>
                      <th>Gross</th>
                      <th>Net</th>
                      <th>Refunds</th>
                      <th>Net Rev</th>
                      <th>TZ Shift?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debugMetrics.dailyBreakdown.map((day) => (
                      <tr key={day.day} className={day.shiftsDay ? 'text-yellow-300' : ''}>
                        <td>{day.day}</td>
                        <td>{day.donationCount}</td>
                        <td>${day.grossDonations.toFixed(2)}</td>
                        <td>${day.netDonations.toFixed(2)}</td>
                        <td>${day.refunds.toFixed(2)}</td>
                        <td>${day.netRevenue.toFixed(2)}</td>
                        <td>{day.shiftsDay ? '⚠️' : '✓'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Timezone Shift Details */}
              {debugMetrics.timezoneShiftTxs.length > 0 && (
                <div className="mb-4 p-2 bg-gray-800 rounded">
                  <div className="text-yellow-400 font-bold mb-1">Transactions Shifting Days</div>
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="text-gray-500">
                        <th>TX ID</th>
                        <th>Amount</th>
                        <th>UTC Day</th>
                        <th>Local Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debugMetrics.timezoneShiftTxs.slice(0, 10).map((tx) => (
                        <tr key={tx.transactionId}>
                          <td>{tx.transactionId.slice(0, 10)}...</td>
                          <td>${tx.amount}</td>
                          <td>{tx.dayUtc}</td>
                          <td>{tx.dayLocal}</td>
                        </tr>
                      ))}
                      {debugMetrics.timezoneShiftTxs.length > 10 && (
                        <tr className="text-gray-500">
                          <td colSpan={4}>... and {debugMetrics.timezoneShiftTxs.length - 10} more</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Duplicates */}
              {debugMetrics.duplicates.length > 0 && (
                <div className="mb-4 p-2 bg-red-900/30 rounded">
                  <div className="text-red-400 font-bold mb-1">Duplicate Transactions</div>
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="text-gray-500">
                        <th>Transaction ID</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debugMetrics.duplicates.map((dup) => (
                        <tr key={dup.transactionId}>
                          <td>{dup.transactionId}</td>
                          <td className="text-red-400">{dup.count}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Data Source Info */}
              <div className="text-gray-500 text-[10px] mt-2">
                Source: actblue_transactions_secure (raw query) |
                Dashboard uses: useClientDashboardMetricsQuery
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ActBlueMetricsDebug;
