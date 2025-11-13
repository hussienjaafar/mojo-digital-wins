-- Add customization columns to email_report_schedules
ALTER TABLE public.email_report_schedules
ADD COLUMN IF NOT EXISTS report_config JSONB DEFAULT '{
  "metrics": ["funds_raised", "total_spend", "roi", "donations", "meta_ads", "sms"],
  "includeCharts": true,
  "chartTypes": {
    "fundsRaised": "line",
    "roi": "line",
    "channelSpend": "pie"
  },
  "dateRangeType": "auto",
  "customDays": 30,
  "includeComparison": false,
  "comparisonPeriod": "previous"
}'::jsonb;

-- Add template preferences
ALTER TABLE public.email_report_schedules
ADD COLUMN IF NOT EXISTS template_style TEXT DEFAULT 'professional' CHECK (template_style IN ('professional', 'minimal', 'detailed'));

-- Add custom branding options
ALTER TABLE public.email_report_schedules
ADD COLUMN IF NOT EXISTS custom_branding JSONB DEFAULT '{
  "includeLogo": true,
  "primaryColor": "#667eea",
  "footerText": null
}'::jsonb;