-- Backfill hourly_std_dev and relative_std_dev for recent baseline days.
-- Usage (psql):
--   \i scripts/backfill_trend_baseline_stddev.sql
--
-- Adjust window as needed.
WITH hourly_counts AS (
  SELECT
    te.event_id,
    ev.event_key,
    date_trunc('day', te.published_at)::date AS baseline_date,
    date_trunc('hour', te.published_at) AS hour_bucket,
    COUNT(*) AS hour_count
  FROM trend_evidence te
  JOIN trend_events ev ON ev.id = te.event_id
  WHERE te.published_at >= NOW() - INTERVAL '14 days'
  GROUP BY te.event_id, ev.event_key, baseline_date, hour_bucket
),
hourly_stats AS (
  SELECT
    event_key,
    baseline_date,
    AVG(hour_count)::numeric AS hourly_avg,
    STDDEV_POP(hour_count)::numeric AS hourly_std_dev
  FROM hourly_counts
  GROUP BY event_key, baseline_date
),
stats_with_rsd AS (
  SELECT
    event_key,
    baseline_date,
    hourly_avg,
    hourly_std_dev,
    CASE
      WHEN hourly_avg > 0 THEN hourly_std_dev / hourly_avg
      ELSE 0
    END AS relative_std_dev
  FROM hourly_stats
)
UPDATE trend_baselines b
SET
  hourly_std_dev = s.hourly_std_dev,
  relative_std_dev = s.relative_std_dev
FROM stats_with_rsd s
WHERE b.event_key = s.event_key
  AND b.baseline_date = s.baseline_date;
