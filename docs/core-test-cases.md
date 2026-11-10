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
8. **A winning share pays exactly 1 coin; a losing share pays 0.**
9. **A cancelled market refunds every player exactly what they put in**, and refunds the creator their 100-coin seed. A player who already sold at a profit gives that profit back, but never below a zero balance; what can't be taken back comes out of the creator's seed (decision 004).
10. **Tiny trades can't farm rounding.** Thousands of 0.01-coin trades never earn more than one big trade of the same total. Rounding always goes in the pool's favour: no trade lowers the pool's product `yes × no` (a sale by at most one millionth of a coin, see decision 001).

## The two invariants (property tests, 10,000 random sequences)

Each sequence mixes random buys, sales, resolutions (YES / NO) and cancellations by several players. Both rules are checked after **every** step, not only at the end.

11. **No negative balance.** No sequence of actions takes any member's balance below 0. An action that would do so is refused and changes nothing.
12. **Each market nets to zero, to the hundredth.** Coins in (bets + the creator's seed) = coins out (sales + payouts + refunds + the creator's seed return). Nothing is created or lost.

## The creator's seed

13. **At resolution the creator receives exactly the pool's leftover winning shares**, plus any rounding dust. This can be more or less than 100. It never counts as trading profit on the leaderboard.

## Decided on 2026-11-10

- Seed: the creator pays 100 coins to open the pool, and gets the pool's leftovers back at resolution (rule 13), or 100 on cancel (rule 9).
- Amounts are stored as whole hundredths and shown with two decimals.
- Market maker: a constant-product market maker like Manifold's, with p = 0.5, starting at 100 YES / 100 NO shares (50%).

## Where each rule is tested

| Rule | Test file |
| --- | --- |
| 1–6 | `src/core/amm.test.ts` |
| 7, 11, 12 | `src/core/invariants.test.ts` (10,000 random games, checked after every step) |
| 8, 9, 13 | `src/core/settlement.test.ts`, plus rule 8 inside the random games |
| 10 | `src/core/amm.test.ts` (pool side) and `src/core/invariants.test.ts` (tiny trades) |
| 13 (leaderboard) | `src/core/ledger.test.ts` |

The random games are checked to really exercise every action (thousands of buys, sells, creations, resolutions and cancels), and each test was proven able to fail by planting a bug and watching it go red.
