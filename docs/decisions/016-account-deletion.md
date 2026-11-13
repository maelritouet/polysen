# 016 · Account deletion

**Status:** accepted. The rule is the PRD's ("Let members delete their account; their past bets stay in the totals without their name"); the mechanics are Claude's calls and can change.

## Decision
From the wallet page, a member types SUPPRIMER and confirms. In one transaction:
- **Names:** the first name becomes "Ancien membre" and the nickname `ancien-xxxxxx` (random). The invite code is replaced, so old links stop working.
- **Sign-in:** the Supabase Auth row stays, because `profiles` points at it, but it is emptied: e-mail replaced by `<id>@supprime.invalid`, password and metadata wiped, Google link (identities) and sessions deleted, banned for good.
- **Money:** bets, sales, payouts and ledger rows stay as they are, so every market and every total still adds up. A market the person bet on still pays out to the anonymous account.
- **Comments:** soft-deleted, like an admin deletion. They are the person's own words.
- **Photo:** deleted (decision 018).
- **Markets that name them** and are still running (pending or open) are cancelled and refunded, exactly like their « Retirer » button. Their consent ends with the account.
- **The profile** is marked `deleted_at` and suspended. The admin can't unsuspend a deleted account.

**Refused:**
- while a market they **created** is still running, because nobody else could propose its result. They wait for it, or ask the admin to cancel it;
- for an **admin**, so the group never loses its only admin by accident. Give the role to someone else first.

## Why
- Deleting the rows outright would break the ledger's totals and other players' histories. Anonymising keeps the maths whole and removes the person.
- The leaderboard can still show `ancien-xxxxxx` with its realised profit. That is "in the totals without their name".

## To check in phase 5d
The production database role must be allowed to update `auth.users` and delete from `auth.identities` and `auth.sessions`. It works locally as `postgres`. If production refuses, switch to the Supabase admin API with a server-only service key.
