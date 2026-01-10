-- Expand trend_action_outcomes action_type to include meta conversions
ALTER TABLE public.trend_action_outcomes
  DROP CONSTRAINT IF EXISTS trend_action_outcomes_action_type_check;

ALTER TABLE public.trend_action_outcomes
  ADD CONSTRAINT trend_action_outcomes_action_type_check
  CHECK (action_type IN ('sms', 'email', 'alert', 'watchlist', 'dismiss', 'share', 'meta'));
