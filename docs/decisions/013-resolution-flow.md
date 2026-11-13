# 013 · How a market gets its result

**Status:** accepted. The rules are the PRD's; the mechanics below are Claude's calls.

## Decision
- **After the close, the creator proposes** Oui, Non or Annuler, with proof in words (a link to a photo, a message, a witness). Proof is text for now; photo upload can come later.
- **The result pays out 24 hours after the proposal** unless a player disputes it. Only people who traded on the market can dispute, the creator can't dispute their own result, and one dispute each is enough.
- **A disputed result waits for the admin** (admin page: phase 5b). If the admin traded on that market, the backup admin decides.
- **The payout job** (`/api/tick`, every 15 minutes in production, protected by `CRON_SECRET`):
  - pays out every undisputed result older than 24 hours;
  - cancels markets still waiting for a tagged member's approval after 48 hours.

  Each market is settled inside its own transaction, holding the market's row lock, and only if it is still waiting. So two runs at once pay out exactly once (tested, including with the check removed: the test fails).
- **Markets store their outcome and settlement time** (`markets.outcome`, `markets.settled_at`). The leaderboard dates a market's realised gains by `settled_at`, which works even when nobody gets a payout row.
- **One live proposal per market:** a partial unique index on `resolutions (market_id)` for statuses proposed and disputed.

## Why
- Text proof is enough among friends who can check with each other, and it avoids storing photos (a privacy and moderation cost) before we know it's needed.
- Doing payouts in a scheduled job rather than on page load means nobody's visit triggers coin movements, and the job is easy to re-run safely.

## Consequences
- With no result 48 hours after the close, the admin resolves or cancels it (listed on the admin page, phase 5b).
- On Vercel's free plan, cron jobs run once a day at most. Production (phase 5d) needs another trigger every 15 minutes, for example Supabase's scheduler or a paid plan. To decide then.
