# 009 · Pools and shares are stored exactly, at scale 12

**Status:** accepted, 2026-11-11 (phase 3 schema).

## Decision
`markets.pool_yes`, `markets.pool_no`, `trades.shares` and the `positions` view use `numeric(32, 12)`. The server reads them back as strings into `D` (decimal.js).

## Why
The core rounds every share amount to 12 decimals, and coins are hundredths. So every pool and position after any trade has at most 12 decimals, and scale 12 stores them with no rounding at all. The DB book therefore equals the core's replay exactly, and `checkBook` (shares held + pool = coins in, per side) holds on data read from the database. "DB prices = core prices" is an equality, not a tolerance.

`prob_before` and `prob_after` are rounded to 12 decimals. They are only used for the price chart and never feed back into the maths.

## Also
The `positions` view is created `with (security_invoker = true)`. A plain view runs with its owner's rights and would skip row-level security on `trades`. The API roles also have no privileges on it (lock_down_api_roles), and the RLS attack test covers it.
