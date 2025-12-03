-- Add unique constraints for upsert operations

-- For sms_creative_insights: unique on org + campaign + message text
ALTER TABLE public.sms_creative_insights 
ADD CONSTRAINT sms_creative_insights_org_campaign_message_unique 
UNIQUE (organization_id, campaign_id, message_text);

-- For meta_creative_insights: unique on org + campaign + ad_id
ALTER TABLE public.meta_creative_insights 
ADD CONSTRAINT meta_creative_insights_org_campaign_ad_unique 
UNIQUE (organization_id, campaign_id, ad_id);