
# Fix Voter Impact Data: Three Corrections

## Overview

Three data-level fixes to improve accuracy. No code changes needed -- all updates are SQL `UPDATE` statements run against existing rows.

## Fix 1: Recompute Turnout from Raw Counts

The `turnout_pct` in districts and `vote_2024_pct` in states don't match any derivable formula from the other columns (not voted/registered, not voted/voters). We'll standardize turnout as **voted / registered** (the standard definition of voter turnout).

**Districts:** `SET turnout_pct = voted_2024 / muslim_registered` for all districts where `muslim_registered > 0`.

**States:** `SET vote_2024_pct = (sum of district voted_2024) / (sum of district muslim_registered)` for states that have district data. For states without district data (at-large with empty districts), keep existing values since we can't verify them.

## Fix 2: Repair Broken State Records (NC, NJ, MN, CO)

These four states have 0 or near-0 values at the state level despite having substantial district data:

| State | Current State Voters | District Sum |
|-------|---------------------|--------------|
| CO | 0 | 45,820 |
| MN | 0 | 86,375 |
| NC | 546 | 85,023 |
| NJ | 0 | 200,050 |

Update each state's `muslim_voters` and `registered` by summing from their districts. Also recompute `vote_2024_pct` using the summed voted/registered.

## Fix 3: Backfill At-Large District Records

Seven at-large districts (xx-000) have zero data despite their state records having data: AK, DC, DE, ND, SD, VT, WY.

Copy state-level `muslim_voters`, `registered`, and compute `voted_2024` and `didnt_vote_2024` from the state's `vote_2024_pct` into each at-large district record.

## Execution Order

1. Fix 3 first (backfill at-large districts) -- so Fix 1 can include them when computing state-level turnout
2. Fix 2 (repair broken states from district sums)
3. Fix 1 (recompute all turnout percentages)

## Technical Details

All changes use the database insert tool (UPDATE statements), not migrations, since we're modifying data not schema.

### SQL Statements

**Step 1 -- Backfill 7 at-large districts:**
```sql
UPDATE voter_impact_districts SET
  muslim_voters = s.muslim_voters,
  muslim_registered = s.registered,
  voted_2024 = ROUND(s.registered * s.vote_2024_pct),
  didnt_vote_2024 = s.registered - ROUND(s.registered * s.vote_2024_pct),
  turnout_pct = s.vote_2024_pct
FROM voter_impact_states s
WHERE voter_impact_districts.state_code = s.state_code
  AND voter_impact_districts.cd_code LIKE '%-000'
  AND voter_impact_districts.muslim_voters = 0
  AND s.muslim_voters > 0;
```

**Step 2 -- Fix 4 broken state records:**
```sql
UPDATE voter_impact_states SET
  muslim_voters = sub.sum_voters,
  registered = sub.sum_reg,
  vote_2024_pct = CASE WHEN sub.sum_reg > 0
    THEN sub.sum_voted::numeric / sub.sum_reg ELSE 0 END
FROM (
  SELECT state_code,
    SUM(muslim_voters) as sum_voters,
    SUM(muslim_registered) as sum_reg,
    SUM(voted_2024) as sum_voted
  FROM voter_impact_districts
  WHERE state_code IN ('NC','NJ','MN','CO')
  GROUP BY state_code
) sub
WHERE voter_impact_states.state_code = sub.state_code;
```

**Step 3 -- Recompute all district turnout:**
```sql
UPDATE voter_impact_districts
SET turnout_pct = CASE
  WHEN muslim_registered > 0 THEN voted_2024::numeric / muslim_registered
  ELSE 0
END;
```

**Step 4 -- Recompute all state turnout from districts:**
```sql
UPDATE voter_impact_states SET
  vote_2024_pct = COALESCE(sub.turnout, voter_impact_states.vote_2024_pct)
FROM (
  SELECT state_code,
    CASE WHEN SUM(muslim_registered) > 0
      THEN SUM(voted_2024)::numeric / SUM(muslim_registered)
      ELSE NULL END as turnout
  FROM voter_impact_districts
  WHERE muslim_registered > 0
  GROUP BY state_code
) sub
WHERE voter_impact_states.state_code = sub.state_code;
```

## Scope
- 0 files modified
- 4 SQL UPDATE statements against existing data
- Affects: ~435 district rows, ~51 state rows
