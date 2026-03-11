
Root cause confirmed: the current active `get_donor_universe` RPC no longer fails on date `COALESCE`; it now fails in channel flattening with:

`(SELECT array_agg(DISTINCT ch) FROM unnest(array_agg(channels)) AS flattened(ch_arr), unnest(ch_arr) AS ch)`

In Postgres, that inner `ch_arr` resolves as `text` in this context, so `unnest(ch_arr)` becomes `unnest(text)`, which throws the exact runtime error you’re seeing.

## Plan

1. Patch only the active admin RPC signature (`_page, _page_size, _org_filter, ... _channel_filter`) via one new migration.
2. Replace the nested-`unnest` expression with a safe lateral unnest pattern:
   - `FROM donor_base db LEFT JOIN LATERAL unnest(db.channels) AS ch(channel) ON true`
   - Aggregate channels with:
     - `array_agg(DISTINCT ch.channel) FILTER (WHERE ch.channel IS NOT NULL)`
   - Keep a fallback to `ARRAY['organic']::text[]` if needed.
3. Keep all existing behavior unchanged:
   - Admin guard (`has_role`)
   - Pagination
   - Donor identity grouping
   - Filter semantics (`_org_filter`, `_state_filter`, `_search`, `_channel_filter`, etc.)
4. Do not touch frontend code and do not edit generated integration files.

## Technical details

- Scope of change is server-side SQL only.
- The failure is not from the `_org_filter` argument type; it is from channel flattening in `unified`.
- Expected SQL shape for fix:

```sql
unified AS (
  SELECT
    lower(trim(db.donor_email)) AS identity_key,
    ...
    COALESCE(
      array_agg(DISTINCT ch.channel) FILTER (WHERE ch.channel IS NOT NULL),
      ARRAY['organic']::text[]
    ) AS channels
  FROM donor_base db
  LEFT JOIN LATERAL unnest(db.channels) AS ch(channel) ON true
  GROUP BY lower(trim(db.donor_email))
)
```

## Validation after implementation

1. Re-run the same admin page call (`_page=1`, `_page_size=100`, `_crossover_only=false`) and confirm RPC returns `200` with JSON payload.
2. Confirm Donor Universe rows render on `/admin`.
3. Verify channel filter still works (`sms`, `meta`, `organic`).
4. Spot-check 2–3 donors to ensure totals and crossover counts remain correct.

## Risk / rollback

- Low-risk hotfix: isolated to one function body.
- If needed, rollback is immediate by reapplying previous function version migration.
