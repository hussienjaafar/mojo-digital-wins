-- Fix security definer views - convert to security invoker
ALTER VIEW public.source_health SET (security_invoker = true);
ALTER VIEW public.source_health_summary SET (security_invoker = true);