

# Sheri Maali Audit — Accurate, But Reveals Systemic Bug

## Sheri Maali: Verified Accurate ✓

| Organization | Transactions | Raw Total | Demographics Cache | RPC Would Show |
|---|---|---|---|---|
| Rashid For Illinois | 2 ($250 + $500) | $750 | $750 ✓ | $750 ✓ |
| Wesam Shahed | 1 ($7,300) | $7,300 | $7,300 ✓ | $7,300 ✓ |
| Abdul For Senate | 5 ($1,500+$500+$200+$500+$7,000) | $9,700 | $9,700 ✓ | $9,700 ✓ |
| **Grand Total** | **8 donations** | **$17,750** | **$17,750 ✓** | **$17,750 ✓** |

Sheri Maali's record is correct — all her transaction emails are already lowercase, so the join works fine.

## Critical Systemic Bug Found

However, your instinct was right to audit. The case-sensitivity migration only normalized `donor_demographics` emails to lowercase. The `actblue_transactions` table still has mixed-case emails. The RPC's `tx_stats` → `donor_base` join (line 93-94) is **case-sensitive**:

```sql
LEFT JOIN tx_stats ts ON ts.donor_email = dd.donor_email  -- case-sensitive!
```

This means when a transaction has email `Glass.M.Ashley@gmail.com` but demographics has `glass.m.ashley@gmail.com`, the join fails and that donor shows **$0 total** in the universe.

### Impact

- **2,413 donor-org pairs** have broken joins
- **4,270 transactions** / **$251,887** in donations are invisible
- These donors appear in the universe but with **$0 total donated**

### Fix

One change in the `get_donor_universe` RPC: normalize emails in the `tx_stats` CTE so the join always matches:

```sql
-- In tx_stats CTE, change GROUP BY from:
GROUP BY at.donor_email, at.organization_id
-- To:
GROUP BY lower(trim(at.donor_email)), at.organization_id

-- And SELECT lower(trim(at.donor_email)) AS donor_email
```

This ensures `tx_stats` output is lowercase, matching the already-normalized `donor_demographics`. Same fix needed in the `motivation_data` join.

### Files changed

| File | Change |
|---|---|
| New migration SQL | Update `get_donor_universe` RPC to use `lower(trim())` in `tx_stats` and `donor_base` joins |

No frontend changes needed.

