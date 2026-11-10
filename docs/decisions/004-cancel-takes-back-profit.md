# 004 · Cancelling a market takes back profit already taken, never below zero

**Status:** accepted, 2026-11-10 · *Draft by Claude, for Mael to rewrite in their own words.*

## The problem
Léa buys YES for 100, the price rises, she sells for 160. Then the market is cancelled. "Refund what everyone put in" means Léa owes 60, but she may have spent it.

## Decision
A cancel unwinds everyone's net result:
1. Players still down get back what they put in.
2. Players who sold at a profit give it back, taken from their balance, but never below zero.
3. Any profit that can't be taken back comes out of the creator's seed refund.
4. If even the whole seed can't cover it, the creator gets 0 and the other refunds shrink in proportion.

No coins are ever created. Code: `cancelRefunds` in `src/core/settlement.ts`.

## Alternatives rejected
- Let profit-takers keep their profit: would force the bank to create coins.
- Let the bank cover the shortfall: fairer to the creator, but creates coins.

## Note
Case 4 needs several big price swings; one sale can't profit more than about the seed. It's rare, but tested.
