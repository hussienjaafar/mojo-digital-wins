
-- BULLETPROOF SECURITY - BATCH 2: Remaining 50 tables
-- Fix all {public} policies → {authenticated}

-- Organization-scoped tables with organization_id
DROP POLICY IF EXISTS "Organization members view learnings" ON public.creative_performance_learnings;
CREATE POLICY "cpl_auth" ON public.creative_performance_learnings FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view metrics" ON public.daily_aggregated_metrics;
CREATE POLICY "dam_auth" ON public.daily_aggregated_metrics FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view freshness" ON public.data_freshness_alerts;
CREATE POLICY "dfa_auth" ON public.data_freshness_alerts FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view entity alerts" ON public.client_entity_alerts;
CREATE POLICY "cea_auth" ON public.client_entity_alerts FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view magic moments" ON public.magic_moment_cards;
CREATE POLICY "mmc_auth" ON public.magic_moment_cards FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view onboarding" ON public.client_onboarding_status;
CREATE POLICY "cos_auth" ON public.client_onboarding_status FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view ROI" ON public.roi_analytics;
CREATE POLICY "ra_auth" ON public.roi_analytics FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view meta campaigns" ON public.meta_campaigns;
CREATE POLICY "mc_auth" ON public.meta_campaigns FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view sms campaigns" ON public.sms_campaigns;
CREATE POLICY "sc_auth" ON public.sms_campaigns FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view sms metrics" ON public.sms_campaign_metrics;
CREATE POLICY "scm_auth" ON public.sms_campaign_metrics FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view sms insights" ON public.sms_creative_insights;
CREATE POLICY "sci_auth" ON public.sms_creative_insights FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view suggested actions" ON public.suggested_actions;
CREATE POLICY "sga_auth" ON public.suggested_actions FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view org profiles" ON public.organization_profiles;
CREATE POLICY "op_auth" ON public.organization_profiles FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members view polling config" ON public.polling_alert_configs;
CREATE POLICY "pac_auth" ON public.polling_alert_configs FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view watchlist usage" ON public.watchlist_usage_log;
CREATE POLICY "wul_auth" ON public.watchlist_usage_log FOR SELECT TO authenticated USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

-- User-scoped tables
DROP POLICY IF EXISTS "Users can manage own preferences" ON public.notification_preferences;
CREATE POLICY "np_auth" ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "nf_auth" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
CREATE POLICY "ps_auth" ON public.push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own reports" ON public.scheduled_reports;
CREATE POLICY "sr_auth" ON public.scheduled_reports FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage article preferences" ON public.user_article_preferences;
CREATE POLICY "uap_auth" ON public.user_article_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin-only tables
DROP POLICY IF EXISTS "Admins can view job executions" ON public.job_executions;
CREATE POLICY "je_auth" ON public.job_executions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage job failures" ON public.job_failures;
CREATE POLICY "jf_auth" ON public.job_failures FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view processing batches" ON public.processing_batches;
CREATE POLICY "pb_auth" ON public.processing_batches FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage checkpoints" ON public.processing_checkpoints;
CREATE POLICY "pc_auth" ON public.processing_checkpoints FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view detected anomalies" ON public.detected_anomalies;
CREATE POLICY "da_auth" ON public.detected_anomalies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view submission notes" ON public.submission_notes;
CREATE POLICY "sn_auth" ON public.submission_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members can view deliveries" ON public.webhook_deliveries;
CREATE POLICY "wd_auth" ON public.webhook_deliveries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organization members can view logs" ON public.webhook_logs;
CREATE POLICY "wl_auth" ON public.webhook_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Public intel tables (authenticated read-only)
DROP POLICY IF EXISTS "Anyone can view entity aliases" ON public.entity_aliases;
CREATE POLICY "ea_auth" ON public.entity_aliases FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view entity mentions" ON public.entity_mentions;
CREATE POLICY "em_auth" ON public.entity_mentions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view entity trends" ON public.entity_trends;
CREATE POLICY "etr_auth" ON public.entity_trends FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view watchlist" ON public.entity_watchlist;
CREATE POLICY "ew_auth" ON public.entity_watchlist FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view evergreen topics" ON public.evergreen_topics;
CREATE POLICY "egt_auth" ON public.evergreen_topics FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view executive orders" ON public.executive_orders;
CREATE POLICY "eo_auth" ON public.executive_orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view google news" ON public.google_news_articles;
CREATE POLICY "gna_auth" ON public.google_news_articles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view government announcements" ON public.government_announcements;
CREATE POLICY "ga_auth" ON public.government_announcements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view state actions" ON public.state_actions;
CREATE POLICY "sa_auth" ON public.state_actions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view reddit posts" ON public.reddit_posts;
CREATE POLICY "rp_auth" ON public.reddit_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view polling data" ON public.polling_data;
CREATE POLICY "pd_auth" ON public.polling_data FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Organization members view polling alerts" ON public.polling_alerts;
CREATE POLICY "pa_auth" ON public.polling_alerts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view rss sources" ON public.rss_sources;
CREATE POLICY "rs_auth" ON public.rss_sources FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view export templates" ON public.export_templates;
CREATE POLICY "et_auth" ON public.export_templates FOR SELECT TO authenticated USING (true);

-- Trend/analytics tables (authenticated read-only)
DROP POLICY IF EXISTS "Anyone can view sentiment snapshots" ON public.sentiment_snapshots;
CREATE POLICY "ss_auth" ON public.sentiment_snapshots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view sentiment trends" ON public.sentiment_trends;
CREATE POLICY "st_auth" ON public.sentiment_trends FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view social velocity" ON public.social_velocity_snapshots;
CREATE POLICY "svs_auth" ON public.social_velocity_snapshots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view topic baselines" ON public.topic_baselines;
CREATE POLICY "tb_auth" ON public.topic_baselines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view trend anomalies" ON public.trend_anomalies;
CREATE POLICY "ta_auth" ON public.trend_anomalies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view trend clusters" ON public.trend_clusters;
CREATE POLICY "tc_auth" ON public.trend_clusters FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view trending topics" ON public.trending_topics;
CREATE POLICY "tt_auth" ON public.trending_topics FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Organization members view sentiment" ON public.daily_group_sentiment;
CREATE POLICY "dgs_auth" ON public.daily_group_sentiment FOR SELECT TO authenticated USING (true);

-- Force RLS on all remaining tables
ALTER TABLE public.creative_performance_learnings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_aggregated_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_freshness_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_entity_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.magic_moment_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_onboarding_status FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roi_analytics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sms_creative_insights FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suggested_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.polling_alert_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_usage_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_article_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_executions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_failures FORCE ROW LEVEL SECURITY;
ALTER TABLE public.processing_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.processing_checkpoints FORCE ROW LEVEL SECURITY;
ALTER TABLE public.detected_anomalies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submission_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entity_aliases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entity_mentions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entity_trends FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entity_watchlist FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evergreen_topics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.executive_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.google_news_articles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.government_announcements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.state_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.polling_data FORCE ROW LEVEL SECURITY;
ALTER TABLE public.polling_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rss_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.export_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_trends FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_velocity_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.topic_baselines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trend_anomalies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trend_clusters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trending_topics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_group_sentiment FORCE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.backfill_status FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bluesky_velocity_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.breaking_news_clusters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_report_logs FORCE ROW LEVEL SECURITY;
