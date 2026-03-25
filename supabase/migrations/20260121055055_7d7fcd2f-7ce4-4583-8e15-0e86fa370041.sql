-- Fix: Drop the DATE parameter version of get_sms_metrics to resolve function overload ambiguity
-- This keeps only the TEXT version which handles date parsing internally

DROP FUNCTION IF EXISTS get_sms_metrics(uuid, date, date);