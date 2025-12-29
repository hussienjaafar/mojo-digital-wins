export interface MetricDefinition {
  title: string;
  description: string;
  calculation?: string;
}

export const metricDefinitions: Record<string, MetricDefinition> = {
  "Net Revenue": {
    title: "Net Revenue",
    description: "Total donations minus platform fees and refunds",
    calculation: "Gross Donations - Fees - Refunds",
  },
  "Net ROI": {
    title: "Net Return on Investment",
    description: "Profit generated per dollar spent on advertising. A value of 1.0 means you doubled your money.",
    calculation: "(Net Revenue - Total Ad Spend) / Total Ad Spend",
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
  "Attribution Quality": {
    title: "Attribution Quality Score",
    description: "Percentage of donations with deterministic attribution (refcode or click ID)",
    calculation: "(Attributed Donations / Total Donations) × 100",
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
    title: "Deterministic Attribution",
    description: "Attribution based on direct identifiers like refcodes, click IDs, or campaign mappings",
    calculation: "Refcode + Click ID + Campaign matches",
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
