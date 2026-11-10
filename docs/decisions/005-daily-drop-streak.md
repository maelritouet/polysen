# 005 · Daily drop and streak: how the +10 per day counts

**Status:** Claude's call, 2026-11-10 · *Mael to confirm or change.*

## Decision
The drop is 50 coins on day 1 of a streak, +10 for each consecutive day after that, with the bonus capped at +50: 50, 60, 70, 80, 90, 100, 100… Missing a day restarts at 50. Code: `dailyDropAmount` in `src/core/ledger.ts`.

## Why
The PRD says "+10 per consecutive day, up to +50" without saying whether day 1 already counts. Starting the bonus on day 2 means a single visit is never rewarded as a streak.
