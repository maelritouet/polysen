# 003 · The creator's seed: leftovers go back to the creator

**Status:** superseded by 007 on 2026-11-11 (the creator now gets back at most the seed + 1% of what the crowd lost). Accepted 2026-11-10, merged in PR #1.

## Decision
Launching a market costs 100 coins, which seed the pool. At resolution the creator receives the pool's leftover winning shares (1 coin each) plus everyone's rounding dust. That can be more or less than 100. On a cancel, the creator gets the 100 back (see 004 for the one exception). Code: `src/core/settlement.ts`.

## Why
- The seed is the market maker's money: whatever the crowd wins, the pool loses, and vice versa. Giving the leftover to the creator keeps every coin accounted for.
- It never counts as trading profit, so it can't move the leaderboard (`isTradingReason` in `src/core/ledger.ts`).

## Consequence worth knowing
Players together can win at most the creator's seed from a market; that's the precise form of rule 7.
