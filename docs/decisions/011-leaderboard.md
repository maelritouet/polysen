# 011 · The leaderboard ranks realised trading profit

**Status:** accepted. Rules approved by Mael in phase 4 planning (realised profit only, Monday reset, season = semester); the cost method and season dates are Claude's calls, open to change.

## Decision
- **What counts: realised profit.** A gain or loss counts when shares leave your hands:
  - **on a sale:** coins received minus what the sold shares cost you, at your **average price** on that side (selling a third of your shares takes a third of their cost). Selling everything takes the whole remaining cost, so no rounding is left over;
  - **when a market ends** (resolution or cancel): payouts and refunds minus the cost of every share you still hold. A losing player with no payout realises minus that cost.
  - A bet still open counts for nothing until it's sold or the market ends.
- **What never counts:** daily drops, the starting grant, creator bonuses, the creator's seed and seed return.
- **Small markets don't count:** only markets where at least 3 different people have traded. When a third player joins, the market's past gains start counting.
- **Week:** Monday 00:00 to Monday 00:00, Paris time. A gain belongs to the week of the sale or of the market's end.
- **Season:** a semester, Paris time: 1 September → 1 February, then 1 February → 1 September.
- **Ranking:** every active member is listed, at 0 if they realised nothing; equal profits share a rank (1, 1, 3).
- **Portfolio:** the cost shown for an open position is the same average-cost basis, so « Si tu vendais tout » shows only what isn't realised yet and nothing is counted twice.

Code: `src/core/leaderboard.ts` (maths), `src/lib/periods.ts` (week and season), `src/server/leaderboard.ts` (loading). Rules 15–18 in `docs/core-test-cases.md`.

## Why
- Ranking by balance would reward whoever claims the daily drop most; ranking by unrealised value would let one big bet in a thin market (100-coin pool) jump to the top without ever being cashed. Realised profit is what you actually won.
- Average cost is the simplest method that adds up: over a market that has ended, a player's realised gains equal exactly their coins out minus coins in (tested on thousands of random games).
- The 3-player rule makes it pointless to farm coins between two accounts (PRD, second accounts).
- The board is computed on each request from `trades` and the ledger: no stored score that could drift. At 10–50 players that's a few thousand rows.

## Consequences
- A gain can appear in last week's ranking after the fact, when a third player joins that market. Accepted: it's rare and the rule stays simple.
- Phase 5 (resolution) needs no change here: resolution writes payout and seed-return rows, which the board already reads.
