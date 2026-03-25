-- Clean up duplicate pending invitations - keep only the most recent one per email/type
-- Mark older duplicates as 'revoked' instead of 'superseded'
WITH ranked_invites AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY email, invitation_type ORDER BY created_at DESC) as rn
  FROM public.user_invitations 
  WHERE status = 'pending'
)
UPDATE public.user_invitations 
SET status = 'revoked'
WHERE id IN (SELECT id FROM ranked_invites WHERE rn > 1);