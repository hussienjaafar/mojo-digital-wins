-- =============================================
-- SYSTEM-WIDE REFCODE ATTRIBUTION FRAMEWORK
-- =============================================

-- 1. Global attribution rules table (applies to all orgs unless overridden)
CREATE TABLE public.refcode_attribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'sms', 'email', 'direct', 'organic', 'other')),
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_global BOOLEAN NOT NULL DEFAULT false,
  match_type TEXT NOT NULL DEFAULT 'prefix' CHECK (match_type IN ('prefix', 'suffix', 'contains', 'exact', 'regex')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_org_pattern UNIQUE NULLS NOT DISTINCT (organization_id, pattern, match_type)
);

-- Index for fast lookups
CREATE INDEX idx_attribution_rules_org ON public.refcode_attribution_rules(organization_id) WHERE is_active = true;
CREATE INDEX idx_attribution_rules_global ON public.refcode_attribution_rules(is_global) WHERE is_active = true AND is_global = true;

-- 2. Attributed donations table (stores attribution results)
CREATE TABLE public.attributed_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  refcode TEXT,
  attributed_platform TEXT NOT NULL,
  attribution_method TEXT NOT NULL,
  attribution_confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (attribution_confidence >= 0 AND attribution_confidence <= 1),
  rule_id UUID REFERENCES public.refcode_attribution_rules(id) ON DELETE SET NULL,
  ad_id TEXT,
  campaign_id TEXT,
  creative_id TEXT,
  amount NUMERIC(12,2) NOT NULL,
  transaction_date DATE NOT NULL,
  donor_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_org_transaction UNIQUE (organization_id, transaction_id)
);

-- Indexes for common queries
CREATE INDEX idx_attributed_donations_org_date ON public.attributed_donations(organization_id, transaction_date);
CREATE INDEX idx_attributed_donations_platform ON public.attributed_donations(organization_id, attributed_platform);
CREATE INDEX idx_attributed_donations_refcode ON public.attributed_donations(refcode) WHERE refcode IS NOT NULL;

-- 3. Attribution run logs for auditing
CREATE TABLE public.attribution_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('full', 'incremental', 'single')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  transactions_processed INTEGER DEFAULT 0,
  transactions_attributed INTEGER DEFAULT 0,
  by_platform JSONB DEFAULT '{}',
  by_method JSONB DEFAULT '{}',
  errors JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_attribution_runs_org ON public.attribution_runs(organization_id, started_at DESC);

-- 4. Enable RLS
ALTER TABLE public.refcode_attribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributed_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for refcode_attribution_rules (using client_users table)
CREATE POLICY "Users can view global rules" ON public.refcode_attribution_rules
  FOR SELECT USING (is_global = true);

CREATE POLICY "Org members can view their rules" ON public.refcode_attribution_rules
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage their rules" ON public.refcode_attribution_rules
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for attributed_donations
CREATE POLICY "Org members can view attributed donations" ON public.attributed_donations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for attribution_runs
CREATE POLICY "Org members can view attribution runs" ON public.attribution_runs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE id = auth.uid()
    )
  );

-- 5. Function to match refcode against rules
CREATE OR REPLACE FUNCTION public.match_refcode_to_platform(
  p_refcode TEXT,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  platform TEXT,
  rule_id UUID,
  match_type TEXT,
  confidence NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refcode_lower TEXT;
BEGIN
  v_refcode_lower := lower(trim(COALESCE(p_refcode, '')));
  
  -- Return unattributed if no refcode
  IF v_refcode_lower = '' THEN
    RETURN QUERY SELECT 'unattributed'::TEXT, NULL::UUID, 'none'::TEXT, 0.0::NUMERIC;
    RETURN;
  END IF;
  
  -- Check org-specific rules first, then global rules
  RETURN QUERY
  WITH matched_rules AS (
    SELECT 
      r.platform,
      r.id as rule_id,
      r.match_type,
      r.priority,
      CASE r.match_type
        WHEN 'exact' THEN 1.0
        WHEN 'prefix' THEN 0.95
        WHEN 'suffix' THEN 0.90
        WHEN 'contains' THEN 0.85
        WHEN 'regex' THEN 0.80
      END as confidence,
      CASE 
        WHEN r.organization_id = p_organization_id THEN 0
        ELSE 1
      END as org_priority
    FROM public.refcode_attribution_rules r
    WHERE r.is_active = true
      AND (r.organization_id = p_organization_id OR r.is_global = true)
      AND (
        (r.match_type = 'exact' AND lower(r.pattern) = v_refcode_lower)
        OR (r.match_type = 'prefix' AND v_refcode_lower LIKE lower(r.pattern) || '%')
        OR (r.match_type = 'suffix' AND v_refcode_lower LIKE '%' || lower(r.pattern))
        OR (r.match_type = 'contains' AND v_refcode_lower LIKE '%' || lower(r.pattern) || '%')
        OR (r.match_type = 'regex' AND v_refcode_lower ~ r.pattern)
      )
    ORDER BY org_priority, r.priority, confidence DESC
    LIMIT 1
  )
  SELECT 
    mr.platform,
    mr.rule_id,
    mr.match_type,
    mr.confidence
  FROM matched_rules mr;
  
  -- If no match found, return 'other' with low confidence
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'other'::TEXT, NULL::UUID, 'unmatched'::TEXT, 0.5::NUMERIC;
  END IF;
END;
$$;

-- 6. Function to attribute a single transaction
CREATE OR REPLACE FUNCTION public.attribute_transaction(
  p_organization_id UUID,
  p_transaction_id TEXT,
  p_refcode TEXT,
  p_amount NUMERIC,
  p_transaction_date DATE,
  p_donor_email TEXT DEFAULT NULL
)
RETURNS public.attributed_donations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.attributed_donations;
  v_match RECORD;
  v_ad_id TEXT;
  v_campaign_id TEXT;
  v_creative_id TEXT;
  v_method TEXT;
BEGIN
  -- Get platform match from rules
  SELECT * INTO v_match FROM public.match_refcode_to_platform(p_refcode, p_organization_id);
  
  -- Try to find ad mapping if platform is meta
  IF v_match.platform = 'meta' AND p_refcode IS NOT NULL THEN
    SELECT 
      rm.ad_id,
      rm.campaign_id,
      mci.creative_id
    INTO v_ad_id, v_campaign_id, v_creative_id
    FROM public.refcode_mappings rm
    LEFT JOIN public.meta_creative_insights mci ON rm.ad_id = mci.ad_id
    WHERE rm.organization_id = p_organization_id
      AND lower(rm.refcode) = lower(p_refcode)
    LIMIT 1;
    
    IF v_ad_id IS NOT NULL THEN
      v_method := 'refcode_ad_mapped';
    ELSE
      v_method := 'refcode_pattern';
    END IF;
  ELSIF v_match.match_type = 'none' THEN
    v_method := 'unattributed';
  ELSE
    v_method := 'refcode_' || v_match.match_type;
  END IF;
  
  -- Insert or update attribution
  INSERT INTO public.attributed_donations (
    organization_id,
    transaction_id,
    refcode,
    attributed_platform,
    attribution_method,
    attribution_confidence,
    rule_id,
    ad_id,
    campaign_id,
    creative_id,
    amount,
    transaction_date,
    donor_email,
    metadata
  ) VALUES (
    p_organization_id,
    p_transaction_id,
    p_refcode,
    v_match.platform,
    v_method,
    v_match.confidence,
    v_match.rule_id,
    v_ad_id,
    v_campaign_id,
    v_creative_id,
    p_amount,
    p_transaction_date,
    p_donor_email,
    jsonb_build_object(
      'matched_at', now(),
      'match_type', v_match.match_type
    )
  )
  ON CONFLICT (organization_id, transaction_id) 
  DO UPDATE SET
    refcode = EXCLUDED.refcode,
    attributed_platform = EXCLUDED.attributed_platform,
    attribution_method = EXCLUDED.attribution_method,
    attribution_confidence = EXCLUDED.attribution_confidence,
    rule_id = EXCLUDED.rule_id,
    ad_id = EXCLUDED.ad_id,
    campaign_id = EXCLUDED.campaign_id,
    creative_id = EXCLUDED.creative_id,
    amount = EXCLUDED.amount,
    transaction_date = EXCLUDED.transaction_date,
    donor_email = EXCLUDED.donor_email,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 7. Function to run attribution for all transactions in an org
CREATE OR REPLACE FUNCTION public.run_attribution_batch(
  p_organization_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_force_reprocess BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id UUID;
  v_processed INTEGER := 0;
  v_attributed INTEGER := 0;
  v_by_platform JSONB := '{}';
  v_by_method JSONB := '{}';
  v_errors JSONB := '[]';
  v_tx RECORD;
  v_result public.attributed_donations;
BEGIN
  -- Create run record
  INSERT INTO public.attribution_runs (organization_id, run_type)
  VALUES (p_organization_id, CASE WHEN p_force_reprocess THEN 'full' ELSE 'incremental' END)
  RETURNING id INTO v_run_id;
  
  -- Process transactions
  FOR v_tx IN 
    SELECT 
      t.transaction_id,
      t.refcode,
      t.amount,
      t.transaction_date::DATE as tx_date,
      t.donor_email
    FROM public.actblue_transactions t
    LEFT JOIN public.attributed_donations ad 
      ON ad.organization_id = t.organization_id 
      AND ad.transaction_id = t.transaction_id
    WHERE t.organization_id = p_organization_id
      AND (p_start_date IS NULL OR t.transaction_date::DATE >= p_start_date)
      AND (p_end_date IS NULL OR t.transaction_date::DATE <= p_end_date)
      AND (p_force_reprocess OR ad.id IS NULL)
  LOOP
    BEGIN
      v_result := public.attribute_transaction(
        p_organization_id,
        v_tx.transaction_id,
        v_tx.refcode,
        v_tx.amount,
        v_tx.tx_date,
        v_tx.donor_email
      );
      
      v_processed := v_processed + 1;
      
      IF v_result.attributed_platform != 'unattributed' THEN
        v_attributed := v_attributed + 1;
      END IF;
      
      -- Track by platform
      v_by_platform := jsonb_set(
        v_by_platform,
        ARRAY[v_result.attributed_platform],
        to_jsonb(COALESCE((v_by_platform->>v_result.attributed_platform)::INTEGER, 0) + 1)
      );
      
      -- Track by method
      v_by_method := jsonb_set(
        v_by_method,
        ARRAY[v_result.attribution_method],
        to_jsonb(COALESCE((v_by_method->>v_result.attribution_method)::INTEGER, 0) + 1)
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'transaction_id', v_tx.transaction_id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Update run record
  UPDATE public.attribution_runs
  SET 
    finished_at = now(),
    transactions_processed = v_processed,
    transactions_attributed = v_attributed,
    by_platform = v_by_platform,
    by_method = v_by_method,
    errors = v_errors,
    status = 'completed'
  WHERE id = v_run_id;
  
  RETURN v_run_id;
END;
$$;

-- 8. Function to get attribution summary
CREATE OR REPLACE FUNCTION public.get_attribution_summary(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  platform TEXT,
  total_donations BIGINT,
  total_amount NUMERIC,
  avg_confidence NUMERIC,
  unique_donors BIGINT,
  top_methods JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ad.attributed_platform as platform,
    COUNT(*)::BIGINT as total_donations,
    SUM(ad.amount) as total_amount,
    AVG(ad.attribution_confidence)::NUMERIC as avg_confidence,
    COUNT(DISTINCT ad.donor_email)::BIGINT as unique_donors,
    (
      SELECT jsonb_object_agg(method, cnt)
      FROM (
        SELECT attribution_method as method, COUNT(*) as cnt
        FROM public.attributed_donations sub
        WHERE sub.organization_id = p_organization_id
          AND sub.attributed_platform = ad.attributed_platform
          AND sub.transaction_date BETWEEN p_start_date AND p_end_date
        GROUP BY attribution_method
        ORDER BY cnt DESC
        LIMIT 3
      ) methods
    ) as top_methods
  FROM public.attributed_donations ad
  WHERE ad.organization_id = p_organization_id
    AND ad.transaction_date BETWEEN p_start_date AND p_end_date
  GROUP BY ad.attributed_platform
  ORDER BY total_amount DESC;
END;
$$;

-- 9. Seed global default rules (apply to ALL organizations)
INSERT INTO public.refcode_attribution_rules (pattern, platform, priority, is_global, match_type, description) VALUES
  -- Meta/Facebook patterns
  ('fb', 'meta', 10, true, 'prefix', 'Facebook ad refcodes starting with fb'),
  ('meta', 'meta', 10, true, 'prefix', 'Meta ad refcodes starting with meta'),
  ('jp', 'meta', 20, true, 'prefix', 'Meta ad refcodes starting with jp (common pattern)'),
  ('th', 'meta', 20, true, 'prefix', 'Meta ad refcodes starting with th (common pattern)'),
  ('ig', 'meta', 15, true, 'prefix', 'Instagram ad refcodes starting with ig'),
  
  -- Google patterns
  ('goog', 'google', 10, true, 'prefix', 'Google ad refcodes starting with goog'),
  ('gads', 'google', 10, true, 'prefix', 'Google Ads refcodes starting with gads'),
  ('gsearch', 'google', 10, true, 'prefix', 'Google Search refcodes'),
  ('youtube', 'google', 15, true, 'prefix', 'YouTube ad refcodes'),
  ('yt', 'google', 15, true, 'prefix', 'YouTube ad refcodes (short)'),
  
  -- SMS patterns
  ('txt', 'sms', 10, true, 'prefix', 'SMS refcodes starting with txt'),
  ('sms', 'sms', 10, true, 'prefix', 'SMS refcodes starting with sms'),
  ('text', 'sms', 10, true, 'prefix', 'SMS refcodes starting with text'),
  ('_txt', 'sms', 20, true, 'contains', 'Refcodes containing _txt'),
  ('_sms', 'sms', 20, true, 'contains', 'Refcodes containing _sms'),
  
  -- Email patterns
  ('em', 'email', 10, true, 'prefix', 'Email refcodes starting with em'),
  ('email', 'email', 10, true, 'prefix', 'Email refcodes starting with email'),
  ('eml', 'email', 10, true, 'prefix', 'Email refcodes starting with eml'),
  ('newsletter', 'email', 15, true, 'prefix', 'Newsletter refcodes'),
  ('blast', 'email', 20, true, 'contains', 'Email blast refcodes'),
  
  -- Direct/Organic patterns
  ('direct', 'direct', 10, true, 'prefix', 'Direct traffic refcodes'),
  ('website', 'direct', 15, true, 'prefix', 'Website refcodes'),
  ('organic', 'organic', 10, true, 'prefix', 'Organic traffic refcodes')
ON CONFLICT DO NOTHING;

-- 10. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_refcode_to_platform TO authenticated;
GRANT EXECUTE ON FUNCTION public.attribute_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_attribution_batch TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attribution_summary TO authenticated;