-- Fix donor_demographics_secure view to properly enforce organization access at the row level
-- The current view only masks PII fields but doesn't filter rows by organization membership

DROP VIEW IF EXISTS donor_demographics_secure;

CREATE VIEW donor_demographics_secure 
WITH (security_invoker = false)  -- Keep SECURITY DEFINER to use helper functions
AS
SELECT 
    id,
    organization_id,
    CASE 
        WHEN (has_pii_access() AND can_access_organization_data(organization_id)) THEN donor_email
        ELSE mask_email(donor_email)
    END AS donor_email,
    CASE 
        WHEN (has_pii_access() AND can_access_organization_data(organization_id)) THEN first_name
        ELSE mask_name(first_name)
    END AS first_name,
    CASE 
        WHEN (has_pii_access() AND can_access_organization_data(organization_id)) THEN last_name
        ELSE mask_name(last_name)
    END AS last_name,
    CASE 
        WHEN (has_pii_access() AND can_access_organization_data(organization_id)) THEN phone
        ELSE mask_phone(phone)
    END AS phone,
    CASE 
        WHEN (has_pii_access() AND can_access_organization_data(organization_id)) THEN address
        ELSE mask_address(address)
    END AS address,
    city,
    state,
    CASE 
        WHEN (has_pii_access() AND can_access_organization_data(organization_id)) THEN zip
        ELSE (LEFT(COALESCE(zip, ''), 3) || '**')
    END AS zip,
    country,
    CASE 
        WHEN (has_pii_access() AND can_access_organization_data(organization_id)) THEN employer
        ELSE '*** [Hidden]'
    END AS employer,
    CASE 
        WHEN (has_pii_access() AND can_access_organization_data(organization_id)) THEN occupation
        ELSE '*** [Hidden]'
    END AS occupation,
    total_donated,
    first_donation_date,
    last_donation_date,
    donation_count,
    is_recurring,
    party_affiliation,
    voter_score,
    age,
    gender,
    voter_file_matched,
    created_at,
    updated_at
FROM donor_demographics
WHERE can_access_organization_data(organization_id);  -- CRITICAL: Row-level filtering was missing!

-- Add comment explaining the security model
COMMENT ON VIEW donor_demographics_secure IS 
'Secure view that filters donor_demographics by organization access AND masks PII for non-privileged users.
Row access: Only users with can_access_organization_data() can see rows (org admins/managers or system admins).
PII masking: Only users with has_pii_access() AND can_access_organization_data() see unmasked PII fields.
This view should ALWAYS be used instead of direct table access from application code.';