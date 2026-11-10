# 001 · Market maker: constant product (CPMM, p = 0.5)

**Status:** accepted, 2026-11-10 (merged in PR #1)

## Decision
Prices come from a constant-product market maker, the design Manifold uses. The pool holds YES and NO shares; every trade keeps `yes × no` constant, and the probability of YES is `no / (yes + no)`. A market opens with 100 YES and 100 NO (50%). Code: `src/core/amm.ts`.

## Why
- Works with three players: the app is always the other side of a trade.
- Live price and selling at any time (the PRD's choice over a simple pot).
- Exact accounting: each coin in mints one YES + one NO share, so on each side `players' shares + pool's shares = coins in`. That identity is what makes "no coin created or lost" checkable.

## Details that matter
- Rounding always favours the pool: buyers get shares rounded down (12 decimals), sellers and winners get coins rounded down (hundredths).
- One exception, by design: a sale may pay up to one millionth of a coin above its exact value, so that "buy then sell straight back" returns exactly what you paid. Tested: it can't be farmed (rule 10).
- With a 100-coin pool, prices swing a lot; one big bet can move a market from 50% to 99%. That's the PRD's choice ("prices swing a lot") and can be tuned later.
