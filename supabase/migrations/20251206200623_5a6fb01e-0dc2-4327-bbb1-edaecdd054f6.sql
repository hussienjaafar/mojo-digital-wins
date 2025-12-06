
-- =====================================================
-- COMPREHENSIVE SECURITY FIX - PART 2
-- Convert ALL remaining policies from {public} to {authenticated}
-- =====================================================

-- article_bookmarks - Change from public to authenticated
DROP POLICY IF EXISTS "Users can create own bookmarks" ON public.article_bookmarks;
DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.article_bookmarks;
DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.article_bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.article_bookmarks;

CREATE POLICY "bookmarks_select_own" ON public.article_bookmarks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "bookmarks_insert_own" ON public.article_bookmarks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookmarks_update_own" ON public.article_bookmarks
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookmarks_delete_own" ON public.article_bookmarks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.article_bookmarks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.article_bookmarks FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_bookmarks TO authenticated;

-- article_clusters - Change from public to authenticated (public read OK for news)
DROP POLICY IF EXISTS "Admins can manage article clusters" ON public.article_clusters;
DROP POLICY IF EXISTS "Anyone can view article clusters" ON public.article_clusters;

CREATE POLICY "clusters_select_auth" ON public.article_clusters
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "clusters_all_admin" ON public.article_clusters
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.article_clusters FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.article_clusters FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_clusters TO authenticated;

-- articles - Change from public to authenticated
DROP POLICY IF EXISTS "Anyone can view articles" ON public.articles;
DROP POLICY IF EXISTS "Admins can manage articles" ON public.articles;

CREATE POLICY "articles_select_auth" ON public.articles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "articles_all_admin" ON public.articles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.articles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.articles FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;

-- articles_archive
DROP POLICY IF EXISTS "Admins can manage articles archive" ON public.articles_archive;

CREATE POLICY "articles_archive_all_admin" ON public.articles_archive
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.articles_archive FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.articles_archive FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles_archive TO authenticated;

-- attribution_health_logs
DROP POLICY IF EXISTS "Admins can view health logs" ON public.attribution_health_logs;
DROP POLICY IF EXISTS "Service can insert health logs" ON public.attribution_health_logs;

CREATE POLICY "health_logs_select_admin" ON public.attribution_health_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "health_logs_insert_admin" ON public.attribution_health_logs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.attribution_health_logs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.attribution_health_logs FROM anon, public;
GRANT SELECT, INSERT ON public.attribution_health_logs TO authenticated;

-- bill_actions
DROP POLICY IF EXISTS "Anyone can view bill actions" ON public.bill_actions;
DROP POLICY IF EXISTS "Admins can manage bill actions" ON public.bill_actions;

CREATE POLICY "bill_actions_select_auth" ON public.bill_actions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bill_actions_all_admin" ON public.bill_actions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bill_actions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bill_actions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_actions TO authenticated;

-- bill_alerts
DROP POLICY IF EXISTS "Users can update own alerts" ON public.bill_alerts;
DROP POLICY IF EXISTS "Users can create own alerts" ON public.bill_alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON public.bill_alerts;
DROP POLICY IF EXISTS "Users can view own alerts" ON public.bill_alerts;

CREATE POLICY "bill_alerts_select_own" ON public.bill_alerts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "bill_alerts_insert_own" ON public.bill_alerts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bill_alerts_update_own" ON public.bill_alerts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bill_alerts_delete_own" ON public.bill_alerts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.bill_alerts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bill_alerts FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_alerts TO authenticated;

-- bills
DROP POLICY IF EXISTS "Anyone can view bills" ON public.bills;
DROP POLICY IF EXISTS "Admins can manage bills" ON public.bills;
DROP POLICY IF EXISTS "Bills are viewable by everyone" ON public.bills;

CREATE POLICY "bills_select_auth" ON public.bills
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bills_all_admin" ON public.bills
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bills FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bills FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;

-- bluesky_article_correlations
DROP POLICY IF EXISTS "Anyone can view article correlations" ON public.bluesky_article_correlations;

CREATE POLICY "bluesky_correlations_select_auth" ON public.bluesky_article_correlations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bluesky_correlations_all_admin" ON public.bluesky_article_correlations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bluesky_article_correlations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bluesky_article_correlations FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bluesky_article_correlations TO authenticated;

-- bluesky_keywords
DROP POLICY IF EXISTS "Anyone can view keywords" ON public.bluesky_keywords;
DROP POLICY IF EXISTS "Admins can manage keywords" ON public.bluesky_keywords;

CREATE POLICY "keywords_select_auth" ON public.bluesky_keywords
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "keywords_all_admin" ON public.bluesky_keywords
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bluesky_keywords FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bluesky_keywords FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bluesky_keywords TO authenticated;

-- bluesky_posts
DROP POLICY IF EXISTS "Anyone can view bluesky posts" ON public.bluesky_posts;
DROP POLICY IF EXISTS "Admins can manage Bluesky data" ON public.bluesky_posts;
DROP POLICY IF EXISTS "Anyone can view Bluesky posts" ON public.bluesky_posts;

CREATE POLICY "bluesky_posts_select_auth" ON public.bluesky_posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bluesky_posts_all_admin" ON public.bluesky_posts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bluesky_posts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bluesky_posts FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bluesky_posts TO authenticated;

-- bluesky_posts_archive
DROP POLICY IF EXISTS "Admins can manage bluesky archive" ON public.bluesky_posts_archive;

CREATE POLICY "bluesky_archive_all_admin" ON public.bluesky_posts_archive
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bluesky_posts_archive FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bluesky_posts_archive FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bluesky_posts_archive TO authenticated;

-- bluesky_stream_cursor
DROP POLICY IF EXISTS "Admins can view cursor" ON public.bluesky_stream_cursor;
DROP POLICY IF EXISTS "Service can manage cursor" ON public.bluesky_stream_cursor;

CREATE POLICY "cursor_all_admin" ON public.bluesky_stream_cursor
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bluesky_stream_cursor FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bluesky_stream_cursor FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bluesky_stream_cursor TO authenticated;

-- bluesky_topic_clusters
DROP POLICY IF EXISTS "Anyone can view topic clusters" ON public.bluesky_topic_clusters;
DROP POLICY IF EXISTS "Admins can manage clusters" ON public.bluesky_topic_clusters;

CREATE POLICY "clusters_bsky_select_auth" ON public.bluesky_topic_clusters
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "clusters_bsky_all_admin" ON public.bluesky_topic_clusters
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bluesky_topic_clusters FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bluesky_topic_clusters FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bluesky_topic_clusters TO authenticated;

-- bluesky_trends
DROP POLICY IF EXISTS "Admins can manage trends" ON public.bluesky_trends;
DROP POLICY IF EXISTS "Anyone can view Bluesky trends" ON public.bluesky_trends;

CREATE POLICY "trends_select_auth" ON public.bluesky_trends
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "trends_all_admin" ON public.bluesky_trends
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bluesky_trends FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.bluesky_trends FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bluesky_trends TO authenticated;

-- client_api_credentials - Already fixed, just drop old
DROP POLICY IF EXISTS "Only admins can manage credentials" ON public.client_api_credentials;
DROP POLICY IF EXISTS "Only admins can view credentials" ON public.client_api_credentials;

-- client_entity_alerts
DROP POLICY IF EXISTS "Users update own alerts" ON public.client_entity_alerts;
DROP POLICY IF EXISTS "Admins view all alerts" ON public.client_entity_alerts;
DROP POLICY IF EXISTS "Users view own alerts" ON public.client_entity_alerts;

CREATE POLICY "entity_alerts_select_auth" ON public.client_entity_alerts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );
CREATE POLICY "entity_alerts_update_auth" ON public.client_entity_alerts
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );
CREATE POLICY "entity_alerts_all_admin" ON public.client_entity_alerts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.client_entity_alerts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_entity_alerts FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_entity_alerts TO authenticated;

-- client_onboarding_status
DROP POLICY IF EXISTS "Admins can manage all onboarding" ON public.client_onboarding_status;
DROP POLICY IF EXISTS "Users can insert own org onboarding" ON public.client_onboarding_status;
DROP POLICY IF EXISTS "Users can view own org onboarding" ON public.client_onboarding_status;

CREATE POLICY "onboarding_select_auth" ON public.client_onboarding_status
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );
CREATE POLICY "onboarding_insert_auth" ON public.client_onboarding_status
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );
CREATE POLICY "onboarding_update_auth" ON public.client_onboarding_status
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );
CREATE POLICY "onboarding_all_admin" ON public.client_onboarding_status
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.client_onboarding_status FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_onboarding_status FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboarding_status TO authenticated;

-- Drop old client_organizations policies (already fixed)
DROP POLICY IF EXISTS "Users can view own organization" ON public.client_organizations;
DROP POLICY IF EXISTS "Admins can manage organizations" ON public.client_organizations;

-- Ensure service role has full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
