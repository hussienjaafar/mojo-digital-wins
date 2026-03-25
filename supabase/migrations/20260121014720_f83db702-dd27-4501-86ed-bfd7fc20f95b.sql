-- Add RLS policy to allow client users to read their organization's CAPI events
CREATE POLICY "Client users can view their org's CAPI events"
ON public.meta_conversion_events
FOR SELECT
USING (
  organization_id IN (
    SELECT cu.organization_id 
    FROM client_users cu 
    WHERE cu.id = auth.uid()
  )
);