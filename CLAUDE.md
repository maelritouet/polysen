# Poly'sen
Play-money prediction market for a friend group. Spec: docs/PRD.md · Build plan: docs/build-plan.md · Core rules: docs/core-test-cases.md

@AGENTS.md

# Commands
- pnpm dev / pnpm test / pnpm typecheck / pnpm lint / pnpm db:generate / pnpm db:migrate

# Rules
- IMPORTANT: src/core/ holds the coin maths (money, amm, settlement, ledger). Change it only after Mael approves a plan, keep every rule in docs/core-test-cases.md tested, and explain the maths in the pull request.
- Coin amounts are bigint hundredths (`Coins`), never JS numbers. Shares and prices use `D` (decimal.js) from src/core/money.ts.
- Coins move only in server functions, inside one database transaction. Never from the browser.
- The browser never queries the database. Every table gets row-level security (deny-all) in the same migration that creates it.
- No secrets in code. Read them from .env.local (see .env.example).
- Run pnpm typecheck and pnpm test before saying a task is done; a Stop hook enforces it.
- No dates or week numbers in plans or docs: refer to phases.

# Docs
- Record any real design choice in docs/decisions/ (one short file each).
