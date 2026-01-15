-- Allow phone_hash to be nullable for SMS events without phone data
ALTER TABLE public.sms_events ALTER COLUMN phone_hash DROP NOT NULL;