# Core test cases

The rules the coin maths (`src/core/amm.ts`, `src/core/ledger.ts`) must always follow. Written by Mael in plain words; Claude turns each one into a test. Every rule here must have a test, and the code may not be merged while one fails.

Amounts are in coins, stored as hundredths (0.01) and shown with two decimals.

## How prices move

1. **Buying YES raises the YES price.** Buying NO lowers it.
2. **The price always stays between 0% and 100%**, whatever the bets. The screen shows it clamped to 1% to 99%.
3. **Buying shares and selling them straight back returns exactly the coins you paid**, to the hundredth, after rounding.
4. **No bet can take more coins out of a pool than it holds.**
5. **YES and NO move the price symmetrically.** From 50%, betting X on YES moves the price up exactly as much as betting X on NO moves it down.
6. **A bigger bet gets more shares, at a worse average price**, than a smaller bet on the same side.

## Nobody creates coins

7. **Trading never creates coins.** Players together can never take more out of a market than the creator's 100-coin seed. (Corrected 2026-11-10: "at most what they put in" was too strict, because winners are paid from the creator's seed. See decision 003.)
8. **A winning share pays at least 1 coin; a losing share pays 0.** A winner gets more than 1 coin per share when the crowd lost coins to the pool (rule 13). (Changed 2026-11-11, decision 007.)
9. **A cancelled market refunds every player exactly what they put in**, and refunds the creator their 100-coin seed. A player who already sold at a profit gives that profit back, but never below a zero balance; what can't be taken back comes out of the creator's seed (decision 004).
10. **Tiny trades can't farm rounding.** Thousands of 0.01-coin trades never earn more than one big trade of the same total. Rounding always goes in the pool's favour: no trade lowers the pool's product `yes × no` (a sale by at most one millionth of a coin, see decision 001).

## The two invariants (property tests, 10,000 random sequences)

Each sequence mixes random buys, sales, resolutions (YES / NO) and cancellations by several players. Both rules are checked after **every** step, not only at the end.

11. **No negative balance.** No sequence of actions takes any member's balance below 0. An action that would do so is refused and changes nothing.
12. **Each market nets to zero, to the hundredth.** Coins in (bets + the creator's seed) = coins out (sales + payouts + refunds + the creator's seed return). Nothing is created or lost.

## The creator's seed

13. **The creator never profits from the pool beyond 1%.** At resolution, after each winner gets 1 coin per share, the pool holds L coins. If L is at most 100, the crowd was right and the creator gets L back (and loses the rest of the seed). If L is more than 100, the crowd lost S = L − 100: the creator gets 100 + 1% of S, and the rest of S goes to the winners in proportion to their winning shares. If nobody won, it goes back to the players in proportion to what they put in. A seed return never counts as trading profit on the leaderboard. (Changed 2026-11-11, decision 007.)

## The creator bonus

14. **The creator bonus is 1% of every bet minus every sale on the market**, everyone's bets included (the creator's too), with no cap. It is paid once, when the market resolves: never on a cancel, and never on a result that gets overturned. Buying and selling straight back earns the creator nothing. It never counts as trading profit. (Decided 2026-11-11, decision 007.)

## The leaderboard

15. **Only realised profit counts.** Selling shares realises what you got minus what those shares cost you at your average price. When a market ends, what you're paid or refunded minus the cost of the shares you still hold is realised. An open bet counts for nothing until then. (Decision 011.)
16. **Over a market that has ended, your realised gains add up exactly to your coins out minus your coins in**, to the hundredth. Buying and selling straight back realises 0. A cancelled market realises 0 overall for every player, except a profit that could not be taken back (rule 9).
17. **Drops, the starting grant, creator bonuses and the creator's seed never count.** Neither do markets where fewer than 3 different people have traded.
18. **The week starts Monday 00:00 Paris time; the season is a semester** (1 September → 1 February → 1 September). Everyone is listed, equal profits share a rank.

## Decided on 2026-11-10

- Seed: the creator pays 100 coins to open the pool, and gets back at most 100 + 1% of what the crowd lost at resolution (rule 13, changed 2026-11-11), or 100 on cancel (rule 9).
- Amounts are stored as whole hundredths and shown with two decimals.
- Market maker: a constant-product market maker like Manifold's, with p = 0.5, starting at 100 YES / 100 NO shares (50%).

## Where each rule is tested

| Rule | Test file |
| --- | --- |
| 1–6 | `src/core/amm.test.ts` |
| 7, 11, 12 | `src/core/invariants.test.ts` (10,000 random games, checked after every step) |
| 8, 9, 13, 14 | `src/core/settlement.test.ts`, plus rules 8, 13 and 14 inside the random games |
| 10 | `src/core/amm.test.ts` (pool side) and `src/core/invariants.test.ts` (tiny trades) |
| 13 (leaderboard) | `src/core/ledger.test.ts` |
| 15, 16, 17 | `src/core/leaderboard.test.ts` (16 on 2,000 random games), plus `src/server/leaderboard.db.test.ts` against the database |
| 18 | `src/lib/periods.test.ts` and `src/core/leaderboard.test.ts` |

The random games are checked to really exercise every action (thousands of buys, sells, creations, resolutions and cancels), and each test was proven able to fail by planting a bug and watching it go red.
