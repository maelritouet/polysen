# 014 · Admin tools

**Status:** accepted. The rules are the PRD's; the mechanics are Claude's calls.

## Decision
- **`/admin`** (admins only; anyone else gets a 404) lists everything waiting:
  - **disputed results**, with the proof and each dispute;
  - **markets with no result 48 hours after the close**;
  - **reports**;
  - **the members**.

  The admin can rule Oui / Non / Annuler et rembourser, restore a reported market, delete a comment, dismiss a report, suspend or reactivate a member, and take away or give back the right to create markets ("loss of creator rights" in the PRD).
- **The admin page is not the security boundary.** Every admin server function checks the role in the database before doing anything.
- **Conflicts:** an admin who created a market or traded on it can't rule on it, and the server refuses. That's when the backup admin decides.
- **Reports:**
  - one report on a market hides it from everyone but its creator and pauses its betting, until the admin restores or cancels it (PRD);
  - a report on a comment leaves it visible and goes to the admin;
  - one report per member per target.
- **Public log:** every admin action is written to `admin_actions`, and **`/journal`** shows it to every member, with the admin's note.
- **A ruling** settles the market at once, through the same code as the payout job. It closes the live proposal, as *accepted* if it matches the ruling or *overturned* if not, and records the admin's ruling as the accepted result.

## Making the backup admin
There is no button for it, on purpose: run once in the Supabase SQL editor:
`update profiles set role = 'admin' where nickname = '<pseudo>';`

## Why
- One report hiding a market is the PRD's rule: at 10–50 friends, the admin sees everything and abuse is visible.
- A public log is the cheapest way to be trusted as the judge in a game you also play.
