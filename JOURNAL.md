# Journal

Five lines at the end of each phase: what shipped, what surprised you, what's next.

## Phase 1 · Foundations + core maths
- Shipped: Next.js 16 scaffold, CI, Stop hook, and the coin core (money, market maker, settlement, ledger) with 62 tests, including 10,000 random games checked step by step.
- Surprised: the first version of the random games barely played (286 buys in 1,000 games); a guard test now fails if that happens again.
- Surprised: "players end with at most what they put in" was wrong as written; the true bound is the creator's seed.
- Decided: a cancel takes back profit already taken, never below zero (decision 004).
- Next: phase 2: sign-in, invites, profiles, wallet and daily drop on Supabase.

## Phase 2 · Sign-in, invites, wallet
- Shipped: email sign-in, personal invite links, profiles, the ledger table, wallet with history, daily drop with streak; 44 database tests including an RLS attack through the public API.
- Surprised: Next.js 16 renamed middleware to proxy, and prerenders by default (Cache Components): per-member pages need a loading boundary.
- Surprised: the daily drop has three independent guards against double pay (member lock, insert-if-absent, primary key); removing one changes nothing.
- Next: phase 3: markets, tags, buying and selling through server functions.
