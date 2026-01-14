/**
 * ============================================================================
 * CANONICAL METRIC DEFINITIONS
 * ============================================================================
 *
 * This file defines the single source of truth for all ActBlue-related metrics.
 * ALL dashboard components, charts, and KPIs MUST use these definitions.
 *
 * METRIC CONTRACT (effective 2025-01-14):
 * ----------------------------------------
 * - "Gross Raised": SUM(amount) for transaction_type='donation'
 *   - This is the total dollar amount donors contributed BEFORE ActBlue fees
 *   - ActBlue UI "raised today" shows this number
 *
 * - "Net Raised": SUM(net_amount) for transaction_type='donation'
 *   - net_amount = amount - fee (ActBlue's processing fee, typically 3.95%)
 *   - This is what the organization actually receives before refunds
 *   - If net_amount is NULL, calculate as: amount - COALESCE(fee, 0)
 *
 * - "Refunds": SUM(ABS(net_amount)) for transaction_type IN ('refund', 'cancellation')
 *   - Refunds are recorded as separate transactions (not modifications to originals)
 *   - We use absolute value since amounts may be stored as negative
 *   - Refunds are bucketed by their transaction_date (refund date), not original donation date
 *
 * - "Net Revenue": Net Raised - Refunds
 *   - This is the final amount retained by the organization
 *   - This is the metric used for ROI calculations
 *
 * DAY BUCKETING CONTRACT:
 * -----------------------
 * - All day bucketing uses the organization's timezone (default: America/New_York)
 * - ActBlue timestamps are typically in Eastern Time
 * - Date range queries should use half-open intervals: [start_day, end_day_exclusive)
 *
 * UI LABELING RULES:
 * ------------------
 * - If showing gross amounts, label MUST include "Gross" (e.g., "Gross Raised")
 * - If showing net amounts, label MUST include "Net" (e.g., "Net Revenue")
 * - Never use ambiguous labels like "Total Raised" without clarification
 */

export interface MetricDefinition {
  /** Display title shown in UI */
  title: string;
  /** Detailed description for tooltips and help text */
  description: string;
  /** Calculation formula for documentation */
  calculation?: string;
  /** Data source table/view */
  source?: string;
  /** Aggregation type: 'gross', 'net', or 'count' */
  aggregationType?: 'gross' | 'net' | 'count' | 'derived';
}

/**
 * Canonical metric contract - specifies what each metric means and how it's calculated.
 * This is the SINGLE SOURCE OF TRUTH for all dashboard metrics.
 */
export const METRIC_CONTRACT = {
  /**
   * Gross Raised: Total donation amounts before fees
   * - Source: actblue_transactions.amount WHERE transaction_type = 'donation'
   * - This matches ActBlue's "raised" display
   */
  GROSS_RAISED: {
    field: 'amount',
    transactionTypes: ['donation'],
    label: 'Gross Raised',
    description: 'Total donation amounts before ActBlue processing fees',
  },

  /**
   * Net Raised: Donation amounts after fees, before refunds
   * - Source: actblue_transactions.net_amount WHERE transaction_type = 'donation'
   * - Fallback: amount - fee
   */
  NET_RAISED: {
    field: 'net_amount',
    fallbackCalculation: 'amount - COALESCE(fee, 0)',
    transactionTypes: ['donation'],
    label: 'Net Raised',
    description: 'Donation amounts after ActBlue fees, before refunds',
  },

  /**
   * Refunds: Absolute value of refund/cancellation amounts
   * - Source: ABS(actblue_transactions.net_amount) WHERE transaction_type IN ('refund', 'cancellation')
   * - Refunds are recorded on their own date, not the original donation date
   */
  REFUNDS: {
    field: 'net_amount',
    useAbsoluteValue: true,
    transactionTypes: ['refund', 'cancellation'],
    label: 'Refunds',
    description: 'Total refunds and cancellations (by refund date)',
  },

  /**
   * Net Revenue: Final retained amount
   * - Calculation: Net Raised - Refunds
   * - This is used for ROI calculations
   */
  NET_REVENUE: {
    calculation: 'NET_RAISED - REFUNDS',
    label: 'Net Revenue',
    description: 'Final amount retained after fees and refunds',
  },

  /**
   * Total Fees: ActBlue processing fees
   * - Source: actblue_transactions.fee WHERE transaction_type = 'donation'
   */
  TOTAL_FEES: {
    field: 'fee',
    transactionTypes: ['donation'],
    label: 'Processing Fees',
    description: 'ActBlue processing fees (typically 3.95%)',
  },
} as const;

/**
 * Default organization timezone for ActBlue day bucketing.
 * ActBlue is US-focused and most orgs operate in Eastern Time.
 */
export const DEFAULT_ORG_TIMEZONE = 'America/New_York';

export const metricDefinitions: Record<string, MetricDefinition> = {
  // Core fundraising metrics (per contract above)
  "Gross Raised": {
    title: "Gross Raised",
    description: "Total donation amounts before ActBlue processing fees. This matches the 'raised' amount shown in ActBlue's dashboard.",
    calculation: "SUM(amount) WHERE transaction_type = 'donation'",
    source: "actblue_transactions.amount",
    aggregationType: "gross",
  },
  "Net Raised": {
    title: "Net Raised",
    description: "Donation amounts after ActBlue's processing fees are deducted. This is what your organization receives before any refunds.",
    calculation: "SUM(net_amount) WHERE transaction_type = 'donation'",
    source: "actblue_transactions.net_amount",
    aggregationType: "net",
  },
  "Net Revenue": {
    title: "Net Revenue",
    description: "Final amount retained after processing fees AND refunds. This is the true revenue for ROI calculations.",
    calculation: "Net Raised - Refunds",
    aggregationType: "derived",
  },
  "Refunds": {
    title: "Refunds",
    description: "Total amount refunded or cancelled. Refunds are recorded on the date they occur, not the original donation date.",
    calculation: "SUM(ABS(net_amount)) WHERE transaction_type IN ('refund', 'cancellation')",
    source: "actblue_transactions.net_amount",
    aggregationType: "net",
  },
  "Processing Fees": {
    title: "Processing Fees",
    description: "ActBlue's processing fees (typically 3.95% of donation amount).",
    calculation: "SUM(fee) WHERE transaction_type = 'donation'",
    source: "actblue_transactions.fee",
    aggregationType: "gross",
  },
  "Net ROI": {
    title: "Net Return on Investment",
    description: "Investment multiplier showing how many times your ad spend was returned. 1.15x means $1.15 back for every $1 spent.",
    calculation: "Net Revenue / Total Ad Spend",
  },
  "ROAS": {
    title: "Return on Ad Spend",
    description: "Total revenue generated per dollar spent on advertising",
    calculation: "Net Revenue / Total Ad Spend",
  },
  "Refund Rate": {
    title: "Refund Rate",
    description: "Percentage of donations that were refunded",
    calculation: "(Refund Amount / Gross Donations) × 100",
  },
  "Recurring Health": {
    title: "Recurring Donation Health",
    description: "Total value from recurring donations. Lower churn indicates healthier recurring program.",
    calculation: "Sum of recurring transaction amounts",
  },
  "Current Active MRR": {
    title: "Current Active MRR",
    description: "Expected monthly revenue from currently active recurring donors",
    calculation: "Sum of active recurring amounts (monthly run-rate)",
  },
  "New MRR Added": {
    title: "New MRR Added",
    description: "Monthly run-rate added by donors who started recurring in the selected period",
    calculation: "Sum of new recurring amounts (monthly run-rate)",
  },
  "Attribution Quality": {
    title: "Refcode Match Rate",
    description: "Percentage of donations with a traceable refcode or click ID linking to a campaign",
    calculation: "(Donations with refcode/click_id / Total Donations) × 100",
  },
  "Unique Donors": {
    title: "Unique Donors",
    description: "Count of distinct donors in the selected period",
  },
  "Total Donors": {
    title: "Total Donors",
    description: "All donors in the database for this organization",
  },
  "Major Donors": {
    title: "Major Donors",
    description: "Donors who have contributed $1,000 or more in their lifetime",
    calculation: "Count of donors with lifetime value ≥ $1,000",
  },
  "Attributed": {
    title: "Attributed Donations",
    description: "Donations that can be linked to a specific platform or campaign",
  },
  "Topics Linked": {
    title: "Topics Linked",
    description: "Donations with an AI-identified creative topic from ad content",
  },
  "Deterministic": {
    title: "Refcode Match",
    description: "Attribution based on refcodes or click IDs embedded in ActBlue donation links. This is the only reliable per-donor attribution method.",
    calculation: "Refcode + Click ID matches from ActBlue transactions",
  },
  "Meta CPA": {
    title: "Meta Cost Per Acquisition",
    description: "Average cost to acquire one donor through Meta ads",
    calculation: "Meta Ad Spend / Meta-Attributed Donations",
  },
  "Meta ROAS": {
    title: "Meta Return on Ad Spend",
    description: "Revenue generated per dollar spent on Meta ads",
    calculation: "Net Revenue from Meta / Meta Ad Spend",
  },
  "SMS CAC": {
    title: "SMS Customer Acquisition Cost",
    description: "Cost to acquire one donating recipient via SMS",
    calculation: "SMS Spend / SMS Conversions",
  },
  "LTV 90": {
    title: "90-Day Lifetime Value",
    description: "Predicted donor value over the next 90 days",
  },
  "LTV 180": {
    title: "180-Day Lifetime Value",
    description: "Predicted donor value over the next 180 days",
  },
  "Churn Risk": {
    title: "Churn Risk",
    description: "Probability that a donor will not donate again in the prediction window",
    calculation: "ML model based on recency, frequency, and monetary scores",
  },
  "RFM Score": {
    title: "RFM Score",
    description: "Combined Recency, Frequency, and Monetary score (1-5 scale)",
    calculation: "Average of R, F, and M scores",
  },
};

export function getMetricDefinition(label: string): MetricDefinition | undefined {
  return metricDefinitions[label];
}
