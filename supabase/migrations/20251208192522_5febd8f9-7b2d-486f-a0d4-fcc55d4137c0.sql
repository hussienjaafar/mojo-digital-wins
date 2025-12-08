-- Drop the insecure view and create a secure version with proper authorization
DROP VIEW IF EXISTS donor_segments;

-- Create secure donor_segments view with authorization and PII masking
CREATE OR REPLACE VIEW donor_segments AS
SELECT 
    dd.id,
    dd.organization_id,
    -- Mask PII fields for users without PII access
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.donor_email 
         ELSE CONCAT(LEFT(SPLIT_PART(dd.donor_email, '@', 1), 2), '***@', SPLIT_PART(dd.donor_email, '@', 2))
    END AS donor_email,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.first_name 
         ELSE CONCAT(LEFT(dd.first_name, 1), '***')
    END AS first_name,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.last_name 
         ELSE CONCAT(LEFT(dd.last_name, 1), '***')
    END AS last_name,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.city ELSE '***' END AS city,
    dd.state,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.zip 
         ELSE CONCAT(LEFT(dd.zip, 3), '**')
    END AS zip,
    dd.total_donated,
    dd.donation_count,
    dd.first_donation_date,
    dd.last_donation_date,
    dd.is_recurring,
    CASE
        WHEN (dd.total_donated >= 1000::numeric) THEN 'major'::text
        WHEN (dd.donation_count >= 5) THEN 'repeat'::text
        WHEN (dd.last_donation_date > (now() - '90 days'::interval)) THEN 'active'::text
        WHEN (dd.last_donation_date > (now() - '180 days'::interval)) THEN 'lapsing'::text
        ELSE 'lapsed'::text
    END AS donor_tier,
    CASE
        WHEN (dd.donation_count = 1) THEN 'new'::text
        WHEN (dd.donation_count >= 2 AND dd.donation_count <= 4) THEN 'developing'::text
        WHEN (dd.donation_count >= 5) THEN 'loyal'::text
        ELSE 'unknown'::text
    END AS donor_frequency_segment,
    date_part('day'::text, (now() - dd.last_donation_date)) AS days_since_donation,
    CASE
        WHEN (dd.total_donated >= 1000::numeric) THEN 5
        WHEN (dd.total_donated >= 500::numeric) THEN 4
        WHEN (dd.total_donated >= 100::numeric) THEN 3
        WHEN (dd.total_donated >= 25::numeric) THEN 2
        ELSE 1
    END AS monetary_score,
    CASE
        WHEN (dd.donation_count >= 10) THEN 5
        WHEN (dd.donation_count >= 5) THEN 4
        WHEN (dd.donation_count >= 3) THEN 3
        WHEN (dd.donation_count >= 2) THEN 2
        ELSE 1
    END AS frequency_score,
    CASE
        WHEN (dd.last_donation_date > (now() - '30 days'::interval)) THEN 5
        WHEN (dd.last_donation_date > (now() - '60 days'::interval)) THEN 4
        WHEN (dd.last_donation_date > (now() - '90 days'::interval)) THEN 3
        WHEN (dd.last_donation_date > (now() - '180 days'::interval)) THEN 2
        ELSE 1
    END AS recency_score
FROM donor_demographics dd
WHERE can_access_organization_data(dd.organization_id);

COMMENT ON VIEW donor_segments IS 'Secure donor segments view with organization-scoped access and PII masking';