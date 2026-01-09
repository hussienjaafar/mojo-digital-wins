-- Create a function to get users with their roles and organization memberships
CREATE OR REPLACE FUNCTION public.get_users_with_roles_and_orgs()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_active boolean,
  roles text[],
  organizations jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.created_at,
    p.last_sign_in_at,
    p.is_active,
    COALESCE(
      array_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL), 
      ARRAY[]::text[]
    ) as roles,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'org_id', co.id,
          'org_name', co.name,
          'role', cu.role
        )
      ) FILTER (WHERE cu.id IS NOT NULL),
      '[]'::jsonb
    ) as organizations
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  LEFT JOIN client_users cu ON cu.id = p.id
  LEFT JOIN client_organizations co ON co.id = cu.organization_id
  GROUP BY p.id, p.email, p.created_at, p.last_sign_in_at, p.is_active
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (admins will still need RLS check in calling code)
GRANT EXECUTE ON FUNCTION public.get_users_with_roles_and_orgs() TO authenticated;