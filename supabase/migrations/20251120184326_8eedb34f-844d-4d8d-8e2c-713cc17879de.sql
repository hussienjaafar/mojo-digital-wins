-- Fix search_path security warning for calculate_trend_velocity function
CREATE OR REPLACE FUNCTION calculate_trend_velocity()
RETURNS TRIGGER AS $$
DECLARE
  prev_hour_count INTEGER;
  prev_day_count INTEGER;
  current_count INTEGER;
BEGIN
  -- Get mention count from previous hour
  SELECT COALESCE(SUM(mention_count), 0) INTO prev_hour_count
  FROM trending_topics
  WHERE topic = NEW.topic
    AND hour_timestamp = (NEW.hour_timestamp - INTERVAL '1 hour');

  -- Get mention count from same time yesterday
  SELECT COALESCE(SUM(mention_count), 0) INTO prev_day_count
  FROM trending_topics
  WHERE topic = NEW.topic
    AND hour_timestamp = (NEW.hour_timestamp - INTERVAL '24 hours');

  current_count := NEW.mention_count;

  -- Calculate velocity (percentage increase)
  IF prev_hour_count > 0 THEN
    NEW.velocity_score := ((current_count - prev_hour_count)::DECIMAL / prev_hour_count) * 100;
  ELSIF current_count > 0 THEN
    NEW.velocity_score := 100; -- New topic = 100% growth
  ELSE
    NEW.velocity_score := 0;
  END IF;

  -- Calculate momentum (acceleration of growth)
  IF prev_day_count > 0 AND prev_hour_count > 0 THEN
    NEW.momentum := (
      (current_count - prev_hour_count)::DECIMAL / NULLIF(prev_hour_count, 0) -
      (prev_hour_count - prev_day_count)::DECIMAL / NULLIF(prev_day_count, 0)
    );
  ELSE
    NEW.momentum := NEW.velocity_score / 100;
  END IF;

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;