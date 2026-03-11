
Root cause confirmed from the current backend + network logs:

1) The admin page calls `get_donor_universe` with params:
`_page, _page_size, _crossover_only, _org_filter, _state_filter, ...`  
2) There are two overloaded `get_donor_universe` functions in the database.
3) The overload actually being called still has:
- `COALESCE(ts.first_donation_date, dd.first_donation_date::text)`
- `COALESCE(ts.last_donation_date, dd.last_donation_date::text)`
This mixes `timestamptz` and `text`, which exactly matches the runtime error.
4) The previous “fix” updated the other overload (different signature), so the live admin RPC stayed broken.

Implementation plan (hotfix-first, minimal-risk):

1) Create one new migration that `CREATE OR REPLACE`s the active RPC signature (`_org_filter ... _channel_filter`) and fixes both date expressions to type-safe form:
- `COALESCE(ts.first_donation_date, dd.first_donation_date)`  
- `COALESCE(ts.last_donation_date, dd.last_donation_date)`
(keep as timestamps internally; cast only at final output if needed).

2) Keep all existing filters, pagination, channel logic, and admin guard unchanged so behavior stays identical except for the crash fix.

3) Add a guardrail cleanup in the same migration:
- either patch the legacy overload too, or explicitly deprecate/drop it after confirming no callers, to prevent future “fixed wrong overload” regressions.

Validation plan after applying migration:

1) Re-run the exact admin RPC call shape used by the UI (`_page=1, _page_size=100, _crossover_only=false`) and confirm no 400 error.
2) Open `/admin` → Donor Universe and verify rows render.
3) Confirm first/last donation date fields are populated and sorting/filtering still works.
4) Re-check network: `rpc/get_donor_universe` returns 200 with JSON payload (`donors`, `total_count`, `crossover_count`).
