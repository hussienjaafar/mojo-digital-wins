-- Add resend_count column to user_invitations table
ALTER TABLE public.user_invitations 
ADD COLUMN resend_count integer DEFAULT 0 NOT NULL;