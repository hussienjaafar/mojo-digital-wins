-- =====================================================
-- Enhanced Donor Demographics V2 with Occupation Normalization
-- =====================================================

-- Create occupation category mapping table
CREATE TABLE IF NOT EXISTS public.occupation_categories (
  id SERIAL PRIMARY KEY,
  pattern TEXT NOT NULL UNIQUE,      -- lowercase pattern to match
  category TEXT NOT NULL,            -- Standard category (e.g., "Healthcare")
  subcategory TEXT,                  -- Optional subcategory (e.g., "Physicians")
  sort_order INTEGER DEFAULT 100,    -- For display ordering
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on the mapping table
ALTER TABLE public.occupation_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read occupation categories
CREATE POLICY "occupation_categories_select_all" ON public.occupation_categories
  FOR SELECT TO authenticated USING (true);

-- Only admins can modify occupation categories
CREATE POLICY "occupation_categories_admin_modify" ON public.occupation_categories
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed comprehensive occupation mappings based on SOC categories
INSERT INTO public.occupation_categories (pattern, category, subcategory, sort_order) VALUES
-- Healthcare
('physician', 'Healthcare', 'Physicians', 1),
('doctor', 'Healthcare', 'Physicians', 1),
('md', 'Healthcare', 'Physicians', 1),
('surgeon', 'Healthcare', 'Physicians', 1),
('cardiologist', 'Healthcare', 'Physicians', 1),
('dermatologist', 'Healthcare', 'Physicians', 1),
('radiologist', 'Healthcare', 'Physicians', 1),
('oncologist', 'Healthcare', 'Physicians', 1),
('psychiatrist', 'Healthcare', 'Physicians', 1),
('pediatrician', 'Healthcare', 'Physicians', 1),
('anesthesiologist', 'Healthcare', 'Physicians', 1),
('emergency medicine', 'Healthcare', 'Physicians', 1),
('internist', 'Healthcare', 'Physicians', 1),
('obgyn', 'Healthcare', 'Physicians', 1),
('ob/gyn', 'Healthcare', 'Physicians', 1),
('gynecologist', 'Healthcare', 'Physicians', 1),
('ophthalmologist', 'Healthcare', 'Physicians', 1),
('orthopedic', 'Healthcare', 'Physicians', 1),
('urologist', 'Healthcare', 'Physicians', 1),
('neurologist', 'Healthcare', 'Physicians', 1),
('nurse', 'Healthcare', 'Nursing', 2),
('rn', 'Healthcare', 'Nursing', 2),
('np', 'Healthcare', 'Nursing', 2),
('lpn', 'Healthcare', 'Nursing', 2),
('nursing', 'Healthcare', 'Nursing', 2),
('registered nurse', 'Healthcare', 'Nursing', 2),
('nurse practitioner', 'Healthcare', 'Nursing', 2),
('pharmacist', 'Healthcare', 'Pharmacy', 3),
('pharmacy', 'Healthcare', 'Pharmacy', 3),
('dentist', 'Healthcare', 'Dental', 4),
('dental', 'Healthcare', 'Dental', 4),
('orthodontist', 'Healthcare', 'Dental', 4),
('therapist', 'Healthcare', 'Allied Health', 5),
('psychologist', 'Healthcare', 'Allied Health', 5),
('physical therapist', 'Healthcare', 'Allied Health', 5),
('occupational therapist', 'Healthcare', 'Allied Health', 5),
('healthcare worker', 'Healthcare', 'General', 6),
('hospital', 'Healthcare', 'General', 6),
('medical', 'Healthcare', 'General', 6),
('health care', 'Healthcare', 'General', 6),
('pa-c', 'Healthcare', 'Allied Health', 5),
('physician assistant', 'Healthcare', 'Allied Health', 5),
('chiropractor', 'Healthcare', 'Allied Health', 5),
('veterinarian', 'Healthcare', 'Veterinary', 7),
('vet', 'Healthcare', 'Veterinary', 7),
-- Legal
('attorney', 'Legal', NULL, 10),
('lawyer', 'Legal', NULL, 10),
('counsel', 'Legal', NULL, 10),
('legal', 'Legal', NULL, 10),
('paralegal', 'Legal', NULL, 11),
('judge', 'Legal', NULL, 10),
('law clerk', 'Legal', NULL, 11),
('public defender', 'Legal', NULL, 10),
('prosecutor', 'Legal', NULL, 10),
('associate attorney', 'Legal', NULL, 10),
('partner', 'Legal', NULL, 10),
-- Technology
('software engineer', 'Technology', 'Engineering', 20),
('software developer', 'Technology', 'Engineering', 20),
('programmer', 'Technology', 'Engineering', 20),
('developer', 'Technology', 'Engineering', 20),
('engineer', 'Technology', 'Engineering', 20),
('computer', 'Technology', 'General', 21),
('data scientist', 'Technology', 'Data', 22),
('data analyst', 'Technology', 'Data', 22),
('it ', 'Technology', 'General', 21),
('i.t.', 'Technology', 'General', 21),
('information technology', 'Technology', 'General', 21),
('product manager', 'Technology', 'Product', 23),
('ux designer', 'Technology', 'Design', 24),
('web designer', 'Technology', 'Design', 24),
('cybersecurity', 'Technology', 'Security', 25),
('network', 'Technology', 'Infrastructure', 26),
('systems', 'Technology', 'Infrastructure', 26),
('tech', 'Technology', 'General', 21),
-- Education
('teacher', 'Education', 'K-12', 30),
('professor', 'Education', 'Higher Ed', 31),
('educator', 'Education', 'General', 32),
('principal', 'Education', 'Administration', 33),
('dean', 'Education', 'Administration', 33),
('librarian', 'Education', 'Library', 34),
('tutor', 'Education', 'K-12', 30),
('school', 'Education', 'General', 32),
('instructor', 'Education', 'General', 32),
('academic', 'Education', 'General', 32),
('faculty', 'Education', 'Higher Ed', 31),
('university', 'Education', 'Higher Ed', 31),
('college', 'Education', 'Higher Ed', 31),
-- Finance & Business
('banker', 'Finance', 'Banking', 40),
('bank', 'Finance', 'Banking', 40),
('accountant', 'Finance', 'Accounting', 41),
('cpa', 'Finance', 'Accounting', 41),
('financial', 'Finance', 'General', 42),
('finance', 'Finance', 'General', 42),
('investment', 'Finance', 'Investment', 43),
('analyst', 'Finance', 'Analysis', 44),
('consultant', 'Business & Consulting', NULL, 50),
('consulting', 'Business & Consulting', NULL, 50),
('management', 'Business & Consulting', NULL, 50),
('manager', 'Business & Consulting', 'Management', 51),
('director', 'Executive & Leadership', NULL, 52),
('executive', 'Executive & Leadership', NULL, 52),
('ceo', 'Executive & Leadership', 'C-Suite', 53),
('cfo', 'Executive & Leadership', 'C-Suite', 53),
('coo', 'Executive & Leadership', 'C-Suite', 53),
('cto', 'Executive & Leadership', 'C-Suite', 53),
('president', 'Executive & Leadership', NULL, 53),
('vice president', 'Executive & Leadership', NULL, 53),
('vp', 'Executive & Leadership', NULL, 53),
('founder', 'Executive & Leadership', NULL, 53),
('owner', 'Business Owner', NULL, 54),
('business owner', 'Business Owner', NULL, 54),
('entrepreneur', 'Business Owner', NULL, 54),
('self employed', 'Self-Employed', NULL, 55),
('self-employed', 'Self-Employed', NULL, 55),
('freelance', 'Self-Employed', NULL, 55),
('independent contractor', 'Self-Employed', NULL, 55),
('self', 'Self-Employed', NULL, 55),
-- Real Estate & Construction
('real estate', 'Real Estate', NULL, 60),
('realtor', 'Real Estate', NULL, 60),
('broker', 'Real Estate', NULL, 60),
('contractor', 'Construction & Trades', NULL, 61),
('construction', 'Construction & Trades', NULL, 61),
('architect', 'Architecture & Design', NULL, 62),
('plumber', 'Construction & Trades', NULL, 61),
('electrician', 'Construction & Trades', NULL, 61),
-- Government & Public Service
('government', 'Government & Public Service', NULL, 70),
('federal', 'Government & Public Service', NULL, 70),
('state employee', 'Government & Public Service', NULL, 70),
('public service', 'Government & Public Service', NULL, 70),
('social worker', 'Social Services', NULL, 71),
('social services', 'Social Services', NULL, 71),
('nonprofit', 'Nonprofit', NULL, 72),
('non-profit', 'Nonprofit', NULL, 72),
('ngo', 'Nonprofit', NULL, 72),
('advocacy', 'Nonprofit', NULL, 72),
('military', 'Military', NULL, 73),
('veteran', 'Military', NULL, 73),
-- Arts & Media
('writer', 'Arts & Media', 'Writing', 80),
('author', 'Arts & Media', 'Writing', 80),
('journalist', 'Arts & Media', 'Media', 81),
('reporter', 'Arts & Media', 'Media', 81),
('editor', 'Arts & Media', 'Media', 81),
('producer', 'Arts & Media', 'Entertainment', 82),
('artist', 'Arts & Media', 'Visual Arts', 83),
('designer', 'Arts & Media', 'Design', 84),
('photographer', 'Arts & Media', 'Visual Arts', 83),
('filmmaker', 'Arts & Media', 'Entertainment', 82),
('musician', 'Arts & Media', 'Music', 85),
('actor', 'Arts & Media', 'Entertainment', 82),
('marketing', 'Marketing & Sales', NULL, 86),
('sales', 'Marketing & Sales', NULL, 86),
('advertising', 'Marketing & Sales', NULL, 86),
-- Science & Research
('scientist', 'Science & Research', NULL, 90),
('researcher', 'Science & Research', NULL, 90),
('research', 'Science & Research', NULL, 90),
('biologist', 'Science & Research', NULL, 90),
('chemist', 'Science & Research', NULL, 90),
('physicist', 'Science & Research', NULL, 90),
('lab', 'Science & Research', NULL, 90),
-- Not Employed / Retired
('not employed', 'Not Employed', NULL, 95),
('unemployed', 'Not Employed', NULL, 95),
('retired', 'Retired', NULL, 96),
('retiree', 'Retired', NULL, 96),
('homemaker', 'Homemaker', NULL, 97),
('stay at home', 'Homemaker', NULL, 97),
('student', 'Student', NULL, 98)
ON CONFLICT (pattern) DO NOTHING;

-- Create index for fast pattern matching
CREATE INDEX IF NOT EXISTS idx_occupation_categories_pattern ON public.occupation_categories USING btree (pattern);

-- =====================================================
-- Enhanced Demographics Summary RPC V2
-- Now includes: occupation normalization, recurring %, repeat rate, time heatmap
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_donor_demographics_v2(
  _organization_id uuid,
  _start_date timestamptz DEFAULT NULL,
  _end_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  effective_start_date timestamptz;
  effective_end_date timestamptz;
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  -- Set date range (default to all time if not provided)
  effective_start_date := COALESCE(_start_date, '1900-01-01'::timestamptz);
  effective_end_date := COALESCE(_end_date, now());

  WITH transaction_data AS (
    SELECT 
      donor_email,
      amount,
      state,
      occupation,
      employer,
      refcode,
      is_express,
      is_recurring,
      is_mobile,
      transaction_type,
      transaction_date,
      EXTRACT(DOW FROM transaction_date) as day_of_week,
      EXTRACT(HOUR FROM transaction_date) as hour_of_day
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND transaction_type IS DISTINCT FROM 'refund'
      AND transaction_date >= effective_start_date
      AND transaction_date <= effective_end_date
  ),
  -- Totals with recurring breakdown
  totals AS (
    SELECT 
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donor_count,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(*) FILTER (WHERE is_recurring = true) as recurring_count,
      COUNT(DISTINCT donor_email) FILTER (WHERE is_recurring = true AND donor_email IS NOT NULL) as recurring_donors,
      COALESCE(SUM(amount) FILTER (WHERE is_recurring = true), 0) as recurring_revenue,
      COUNT(*) FILTER (WHERE is_mobile = true) as mobile_donations,
      COUNT(*) FILTER (WHERE is_mobile = false OR is_mobile IS NULL) as desktop_donations
    FROM transaction_data
  ),
  -- Repeat donor analysis
  donor_frequency AS (
    SELECT 
      donor_email,
      COUNT(*) as donation_count,
      SUM(amount) as total_amount,
      MIN(transaction_date) as first_donation,
      MAX(transaction_date) as last_donation
    FROM transaction_data
    WHERE donor_email IS NOT NULL
    GROUP BY donor_email
  ),
  repeat_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE donation_count = 1) as single_donors,
      COUNT(*) FILTER (WHERE donation_count >= 2) as repeat_donors,
      SUM(total_amount) FILTER (WHERE donation_count = 1) as single_donor_revenue,
      SUM(total_amount) FILTER (WHERE donation_count >= 2) as repeat_donor_revenue,
      -- First-time donors (first donation in this period)
      COUNT(*) FILTER (WHERE first_donation >= effective_start_date) as new_donors,
      SUM(total_amount) FILTER (WHERE first_donation >= effective_start_date) as new_donor_revenue
    FROM donor_frequency
  ),
  -- State stats
  state_stats AS (
    SELECT 
      UPPER(TRIM(state)) as state_abbr,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as revenue,
      ROUND(COALESCE(AVG(amount), 0)::numeric, 2) as avg_gift
    FROM transaction_data
    WHERE state IS NOT NULL AND TRIM(state) != ''
    GROUP BY UPPER(TRIM(state))
    ORDER BY revenue DESC
  ),
  -- Normalized occupation stats using category table
  occupation_raw AS (
    SELECT 
      LOWER(TRIM(occupation)) as raw_occupation,
      donor_email,
      amount
    FROM transaction_data
    WHERE occupation IS NOT NULL AND TRIM(occupation) != ''
  ),
  occupation_matched AS (
    SELECT 
      o.raw_occupation,
      o.donor_email,
      o.amount,
      (
        SELECT oc.category 
        FROM occupation_categories oc 
        WHERE o.raw_occupation LIKE '%' || oc.pattern || '%'
        ORDER BY oc.sort_order ASC
        LIMIT 1
      ) as category
    FROM occupation_raw o
  ),
  occupation_stats AS (
    SELECT 
      COALESCE(category, 'Other') as occupation_category,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as revenue,
      ROUND(COALESCE(AVG(amount), 0)::numeric, 2) as avg_gift
    FROM occupation_matched
    GROUP BY COALESCE(category, 'Other')
    ORDER BY revenue DESC
    LIMIT 20
  ),
  -- Channel stats with more detail
  channel_stats AS (
    SELECT 
      CASE 
        WHEN refcode IS NOT NULL AND refcode != '' THEN 'Campaign'
        WHEN is_express = true THEN 'Express'
        ELSE 'Direct'
      END as channel,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as revenue,
      COUNT(DISTINCT donor_email) as unique_donors,
      ROUND(COALESCE(AVG(amount), 0)::numeric, 2) as avg_gift
    FROM transaction_data
    GROUP BY 
      CASE 
        WHEN refcode IS NOT NULL AND refcode != '' THEN 'Campaign'
        WHEN is_express = true THEN 'Express'
        ELSE 'Direct'
      END
    ORDER BY revenue DESC
  ),
  -- Time heatmap (7 days x 24 hours)
  time_heatmap AS (
    SELECT 
      day_of_week::integer as day_of_week,
      hour_of_day::integer as hour,
      COUNT(*) as donation_count,
      COALESCE(SUM(amount), 0) as revenue,
      ROUND(COALESCE(AVG(amount), 0)::numeric, 2) as avg_donation
    FROM transaction_data
    GROUP BY day_of_week::integer, hour_of_day::integer
  ),
  -- Top refcodes/campaigns
  top_refcodes AS (
    SELECT 
      refcode,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as revenue,
      COUNT(DISTINCT donor_email) as unique_donors
    FROM transaction_data
    WHERE refcode IS NOT NULL AND refcode != ''
    GROUP BY refcode
    ORDER BY revenue DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'unique_donor_count', t.unique_donor_count,
        'transaction_count', t.transaction_count,
        'total_revenue', t.total_revenue,
        'recurring_count', t.recurring_count,
        'recurring_donors', t.recurring_donors,
        'recurring_revenue', t.recurring_revenue,
        'recurring_percentage', CASE WHEN t.unique_donor_count > 0 
          THEN ROUND((t.recurring_donors::numeric / t.unique_donor_count * 100), 1) 
          ELSE 0 END,
        'mobile_donations', t.mobile_donations,
        'desktop_donations', t.desktop_donations,
        'mobile_percentage', CASE WHEN t.transaction_count > 0 
          THEN ROUND((t.mobile_donations::numeric / t.transaction_count * 100), 1) 
          ELSE 0 END
      )
      FROM totals t
    ),
    'repeat_stats', (
      SELECT jsonb_build_object(
        'single_donors', r.single_donors,
        'repeat_donors', r.repeat_donors,
        'repeat_rate', CASE WHEN (r.single_donors + r.repeat_donors) > 0 
          THEN ROUND((r.repeat_donors::numeric / (r.single_donors + r.repeat_donors) * 100), 1) 
          ELSE 0 END,
        'single_donor_revenue', COALESCE(r.single_donor_revenue, 0),
        'repeat_donor_revenue', COALESCE(r.repeat_donor_revenue, 0),
        'new_donors', COALESCE(r.new_donors, 0),
        'new_donor_revenue', COALESCE(r.new_donor_revenue, 0)
      )
      FROM repeat_stats r
    ),
    'state_stats', (SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'state_abbr', s.state_abbr,
        'unique_donors', s.unique_donors,
        'transaction_count', s.transaction_count,
        'revenue', s.revenue,
        'avg_gift', s.avg_gift
      )
    ), '[]'::jsonb) FROM state_stats s),
    'occupation_stats', (SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'occupation_category', o.occupation_category,
        'unique_donors', o.unique_donors,
        'count', o.count,
        'revenue', o.revenue,
        'avg_gift', o.avg_gift
      )
    ), '[]'::jsonb) FROM occupation_stats o),
    'channel_stats', (SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'channel', c.channel,
        'count', c.count,
        'revenue', c.revenue,
        'unique_donors', c.unique_donors,
        'avg_gift', c.avg_gift
      )
    ), '[]'::jsonb) FROM channel_stats c),
    'time_heatmap', (SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'day_of_week', h.day_of_week,
        'hour', h.hour,
        'donation_count', h.donation_count,
        'revenue', h.revenue,
        'avg_donation', h.avg_donation
      )
    ), '[]'::jsonb) FROM time_heatmap h),
    'top_refcodes', (SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'refcode', r.refcode,
        'count', r.count,
        'revenue', r.revenue,
        'unique_donors', r.unique_donors
      )
    ), '[]'::jsonb) FROM top_refcodes r)
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_donor_demographics_v2(uuid, timestamptz, timestamptz) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_donor_demographics_v2 IS 'Enhanced donor demographics with occupation normalization, recurring/repeat donor stats, time heatmap, and campaign breakdowns';

-- Add comment on table
COMMENT ON TABLE public.occupation_categories IS 'Mapping table for normalizing raw occupation strings to standardized categories following SOC classification patterns';