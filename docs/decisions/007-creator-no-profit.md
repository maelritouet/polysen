# 007 · The creator doesn't profit from their own market

**Status:** accepted, 2026-11-11. Supersedes 003 and the PRD's "10 coins per new player" bonus.

## Decision
At resolution, after each winner gets 1 coin per winning share, the pool holds L coins (its winning shares plus rounding dust).
- **L ≤ 100 (the crowd was right):** the creator gets L back and loses the rest of the 100-coin seed, as before.
- **L > 100 (the crowd lost S = L − 100 to the pool):** the creator gets 100 + 1% of S. The other 99% of S goes to the winners in proportion to their winning shares. If nobody holds a winning share, it goes back to the players in proportion to the coins they put in. Rounding dust from the split goes to the creator.
- **Creator bonus:** 1% of (all bets − all sales) on the market, everyone's bets included, no cap, rounded down. It is paid once at resolution, never on a cancel, and an overturned result pays none. These are new coins and never count as trading profit.

Code: `resolvePayouts` in `src/core/settlement.ts`, `creatorBonus` in `src/core/ledger.ts`.

## Why
- Mael: the creator shouldn't make money from their own market, or 1% at most. Under 003 the creator was the other side of every bet: if Tom bet 300 on YES and NO won, the creator got 400 back for a 100 seed.
- Paying the bonus per bet would let two friends create coins without limit: with this market maker, buying and selling straight back returns the same coins, so every loop would mint 1% for the creator. Counting bets minus sales, once at resolution, makes that loop worth nothing.

## Example
Seed 100. Tom bets 300 on YES, Sam bets 20 on NO, NO wins. Sam holds 197.78 NO shares, so L = 222.22 and S = 122.22. The creator gets 100 + 1.22 = **101.22**, and Sam gets 197.78 + 121.00 = **318.78**. The bonus is 1% of 320 = **3.20**. (Under 003: Sam 197.78, creator 222.22, plus 20 bonus.)

## Consequences
- The buy sheet shows the payout as a minimum: "au moins X", because the surplus share isn't known until the market resolves.
- Rule 7 still holds: players together can win at most the seed, because the creator always gets back at least min(L, 100).
- The pool always holds at least 100 coins' worth on one side (√(yes × no) ≥ 100), so bets − sales is never negative.
- A known limit: someone who bets on both sides and holds to the end keeps most of their coins, and the creator still earns 1% of those bets. This is bounded by the bettor's balance, and every bet is public.
