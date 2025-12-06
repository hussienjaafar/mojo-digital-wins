
-- =====================================================
-- SECURITY HARDENING: Update all RLS policies from TO public to TO authenticated
-- This is a defensive measure to prevent configuration drift
-- =====================================================

-- client_organizations
ALTER POLICY "Admins can view all organizations" ON public.client_organizations TO authenticated;

-- client_users
ALTER POLICY "Admins can manage all client users" ON public.client_users TO authenticated;
ALTER POLICY "Users can update own last login" ON public.client_users TO authenticated;
ALTER POLICY "Users can view org members" ON public.client_users TO authenticated;

-- creative_performance_learnings
ALTER POLICY "Admins can manage learnings" ON public.creative_performance_learnings TO authenticated;
ALTER POLICY "Admins can view all learnings" ON public.creative_performance_learnings TO authenticated;
ALTER POLICY "Users can view global learnings" ON public.creative_performance_learnings TO authenticated;
ALTER POLICY "Users can view own org learnings" ON public.creative_performance_learnings TO authenticated;

-- daily_aggregated_metrics
ALTER POLICY "Admins can manage aggregated metrics" ON public.daily_aggregated_metrics TO authenticated;
ALTER POLICY "Users can view own org aggregated metrics" ON public.daily_aggregated_metrics TO authenticated;

-- daily_group_sentiment
ALTER POLICY "Service role can manage group sentiment" ON public.daily_group_sentiment TO authenticated;

-- data_freshness_alerts
ALTER POLICY "Admins can manage data freshness alerts" ON public.data_freshness_alerts TO authenticated;
ALTER POLICY "Client users can view their org alerts" ON public.data_freshness_alerts TO authenticated;

-- detected_anomalies
ALTER POLICY "Anyone can view anomalies" ON public.detected_anomalies TO authenticated;
ALTER POLICY "Service can manage anomalies" ON public.detected_anomalies TO authenticated;

-- email_queue
ALTER POLICY "Admins can view email queue" ON public.email_queue TO authenticated;

-- email_report_logs
ALTER POLICY "Admins can view all report logs" ON public.email_report_logs TO authenticated;
ALTER POLICY "Users can view own org report logs" ON public.email_report_logs TO authenticated;

-- email_report_schedules
ALTER POLICY "Admins can manage all report schedules" ON public.email_report_schedules TO authenticated;
ALTER POLICY "Client admins can manage own org report schedules" ON public.email_report_schedules TO authenticated;
ALTER POLICY "Users can view own org report schedules" ON public.email_report_schedules TO authenticated;

-- entity_aliases
ALTER POLICY "Allow public read access" ON public.entity_aliases TO authenticated;
ALTER POLICY "Allow service role to manage" ON public.entity_aliases TO authenticated;

-- entity_mentions
ALTER POLICY "Admins view all mentions" ON public.entity_mentions TO authenticated;
ALTER POLICY "Service insert mentions" ON public.entity_mentions TO authenticated;

-- entity_trends
ALTER POLICY "Everyone view trends" ON public.entity_trends TO authenticated;
ALTER POLICY "Service manage trends" ON public.entity_trends TO authenticated;

-- entity_watchlist
ALTER POLICY "Admins manage watchlists" ON public.entity_watchlist TO authenticated;
ALTER POLICY "Users manage own watchlist" ON public.entity_watchlist TO authenticated;

-- evergreen_topics
ALTER POLICY "Admins can manage evergreen topics" ON public.evergreen_topics TO authenticated;

-- executive_orders
ALTER POLICY "Admins can manage executive orders" ON public.executive_orders TO authenticated;

-- export_templates
ALTER POLICY "Admins can manage templates" ON public.export_templates TO authenticated;
ALTER POLICY "Users can view active templates" ON public.export_templates TO authenticated;

-- generated_reports
ALTER POLICY "Admins can manage all reports" ON public.generated_reports TO authenticated;
ALTER POLICY "Users can view own reports" ON public.generated_reports TO authenticated;

-- google_news_articles
ALTER POLICY "Anyone can read google news" ON public.google_news_articles TO authenticated;
ALTER POLICY "Service can insert google news" ON public.google_news_articles TO authenticated;
ALTER POLICY "Service can update google news" ON public.google_news_articles TO authenticated;

-- government_announcements
ALTER POLICY "Admins can manage government announcements" ON public.government_announcements TO authenticated;

-- job_executions
ALTER POLICY "Admins can manage job executions" ON public.job_executions TO authenticated;

-- job_failures
ALTER POLICY "Admins can view job failures" ON public.job_failures TO authenticated;

-- login_history
ALTER POLICY "Only admins can view login history" ON public.login_history TO authenticated;

-- magic_moment_cards
ALTER POLICY "Admins can manage all cards" ON public.magic_moment_cards TO authenticated;
ALTER POLICY "Users can update own org cards" ON public.magic_moment_cards TO authenticated;
ALTER POLICY "Users can view own org cards" ON public.magic_moment_cards TO authenticated;

-- meta_campaigns
ALTER POLICY "Admins can manage campaigns" ON public.meta_campaigns TO authenticated;
ALTER POLICY "Admins can view all campaigns" ON public.meta_campaigns TO authenticated;
ALTER POLICY "Users can view own org campaigns" ON public.meta_campaigns TO authenticated;

-- notification_preferences
ALTER POLICY "Users can create own preferences" ON public.notification_preferences TO authenticated;
ALTER POLICY "Users can update own preferences" ON public.notification_preferences TO authenticated;
ALTER POLICY "Users can view own preferences" ON public.notification_preferences TO authenticated;

-- notifications
ALTER POLICY "Admins can create notifications" ON public.notifications TO authenticated;
ALTER POLICY "Users can update own notifications" ON public.notifications TO authenticated;

-- organization_profiles
ALTER POLICY "Admins manage org profiles" ON public.organization_profiles TO authenticated;
ALTER POLICY "Users view own org profile" ON public.organization_profiles TO authenticated;

-- polling_alert_configs
ALTER POLICY "Users can delete their org's polling alert configs" ON public.polling_alert_configs TO authenticated;
ALTER POLICY "Users can insert their org's polling alert configs" ON public.polling_alert_configs TO authenticated;
ALTER POLICY "Users can update their org's polling alert configs" ON public.polling_alert_configs TO authenticated;
ALTER POLICY "Users can view their org's polling alert configs" ON public.polling_alert_configs TO authenticated;

-- polling_alerts
ALTER POLICY "Admins view polling alerts" ON public.polling_alerts TO authenticated;

-- polling_data
ALTER POLICY "Everyone view polling" ON public.polling_data TO authenticated;
ALTER POLICY "Service manage polling" ON public.polling_data TO authenticated;

-- processing_batches
ALTER POLICY "Admins can read processing batches" ON public.processing_batches TO authenticated;
ALTER POLICY "Service can manage processing batches" ON public.processing_batches TO authenticated;

-- processing_checkpoints
ALTER POLICY "Admins can view checkpoints" ON public.processing_checkpoints TO authenticated;

-- push_subscriptions
ALTER POLICY "Users can create own subscriptions" ON public.push_subscriptions TO authenticated;
ALTER POLICY "Users can delete own subscriptions" ON public.push_subscriptions TO authenticated;
ALTER POLICY "Users can view own subscriptions" ON public.push_subscriptions TO authenticated;

-- reddit_posts
ALTER POLICY "Anyone can read reddit posts" ON public.reddit_posts TO authenticated;
ALTER POLICY "Service can insert reddit posts" ON public.reddit_posts TO authenticated;
ALTER POLICY "Service can update reddit posts" ON public.reddit_posts TO authenticated;

-- roi_analytics
ALTER POLICY "Admins can manage all roi analytics" ON public.roi_analytics TO authenticated;
ALTER POLICY "Users can view own org roi analytics" ON public.roi_analytics TO authenticated;

-- rss_sources
ALTER POLICY "Admins can manage RSS sources" ON public.rss_sources TO authenticated;
ALTER POLICY "Anyone can view RSS sources" ON public.rss_sources TO authenticated;

-- scheduled_jobs
ALTER POLICY "Admins can manage scheduled jobs" ON public.scheduled_jobs TO authenticated;
ALTER POLICY "Admins can view scheduled jobs" ON public.scheduled_jobs TO authenticated;

-- scheduled_reports
ALTER POLICY "Admins can manage all scheduled reports" ON public.scheduled_reports TO authenticated;
ALTER POLICY "Users can manage own scheduled reports" ON public.scheduled_reports TO authenticated;

-- sentiment_snapshots
ALTER POLICY "Service can manage sentiment snapshots" ON public.sentiment_snapshots TO authenticated;

-- sentiment_trends
ALTER POLICY "Admins can manage sentiment trends" ON public.sentiment_trends TO authenticated;

-- sms_campaign_metrics
ALTER POLICY "Admins can manage sms metrics" ON public.sms_campaign_metrics TO authenticated;
ALTER POLICY "Users can view own org sms metrics" ON public.sms_campaign_metrics TO authenticated;

-- sms_campaigns
ALTER POLICY "Admins can view all SMS campaigns" ON public.sms_campaigns TO authenticated;
ALTER POLICY "Users can view their organization SMS campaigns" ON public.sms_campaigns TO authenticated;

-- sms_creative_insights
ALTER POLICY "Admins can manage SMS insights" ON public.sms_creative_insights TO authenticated;
ALTER POLICY "Admins can view all SMS insights" ON public.sms_creative_insights TO authenticated;
ALTER POLICY "Users can view own org SMS insights" ON public.sms_creative_insights TO authenticated;

-- social_velocity_snapshots
ALTER POLICY "Anyone can view velocity snapshots" ON public.social_velocity_snapshots TO authenticated;

-- state_actions
ALTER POLICY "Admins can manage state actions" ON public.state_actions TO authenticated;

-- submission_notes
ALTER POLICY "Admins can delete their own notes" ON public.submission_notes TO authenticated;
ALTER POLICY "Only admins can create submission notes" ON public.submission_notes TO authenticated;
ALTER POLICY "Only admins can view submission notes" ON public.submission_notes TO authenticated;

-- suggested_actions
ALTER POLICY "Admins view all suggestions" ON public.suggested_actions TO authenticated;
ALTER POLICY "Users update own suggestions" ON public.suggested_actions TO authenticated;
ALTER POLICY "Users view own suggestions" ON public.suggested_actions TO authenticated;

-- topic_baselines
ALTER POLICY "Allow public read of topic_baselines" ON public.topic_baselines TO authenticated;
ALTER POLICY "Allow service role manage topic_baselines" ON public.topic_baselines TO authenticated;

-- trend_anomalies
ALTER POLICY "Service role can manage anomalies" ON public.trend_anomalies TO authenticated;

-- trend_clusters
ALTER POLICY "Anyone can read trend clusters" ON public.trend_clusters TO authenticated;
ALTER POLICY "Service can manage trend clusters" ON public.trend_clusters TO authenticated;

-- trending_topics
ALTER POLICY "Allow public read access to trending topics" ON public.trending_topics TO authenticated;

-- user_article_preferences
ALTER POLICY "Users can insert own preferences" ON public.user_article_preferences TO authenticated;
ALTER POLICY "Users can update own preferences" ON public.user_article_preferences TO authenticated;
ALTER POLICY "Users can view own preferences" ON public.user_article_preferences TO authenticated;

-- watchlist_usage_log
ALTER POLICY "Admins view usage logs" ON public.watchlist_usage_log TO authenticated;
ALTER POLICY "Service log usage" ON public.watchlist_usage_log TO authenticated;

-- webhook_configs
ALTER POLICY "Admins can manage webhook configs" ON public.webhook_configs TO authenticated;
ALTER POLICY "Admins can view webhook configs" ON public.webhook_configs TO authenticated;

-- webhook_deliveries
ALTER POLICY "Admins can manage webhook deliveries" ON public.webhook_deliveries TO authenticated;
ALTER POLICY "Admins can view webhook deliveries" ON public.webhook_deliveries TO authenticated;

-- webhook_logs
ALTER POLICY "Admins can view webhook logs" ON public.webhook_logs TO authenticated;

-- Add comment documenting the security hardening
COMMENT ON SCHEMA public IS 'Standard public schema with security-hardened RLS policies. All policies use TO authenticated role to prevent unauthenticated access even if anon grants are accidentally added.';
