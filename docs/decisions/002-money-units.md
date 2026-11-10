# 002 · Coin amounts: whole hundredths, shown with two decimals

**Status:** accepted, 2026-11-10 (merged in PR #1)

## Decision
Every coin amount is a `bigint` counting hundredths of a coin (100 coins = `10000n`). The UI always shows two decimals (`37.42`). Shares and prices use high-precision decimals (`decimal.js`), never JS floating-point numbers. Code: `src/core/money.ts`.

## Why
- Floating-point maths drifts (0.1 + 0.2 ≠ 0.3); integers don't. "A market nets to zero, to the hundredth" is only checkable with exact amounts.
- Mael chose to show decimals rather than round to whole coins, for transparency.
