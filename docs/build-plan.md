# Poly'sen build plan

Nov 10, 2026 · @Mael

How to build the P0 of Doc with Claude Code, from an empty folder to the founding ten, in five phases.

## Stack

One language end to end, one database, free hosting, and tools Claude Code knows well. At 50 users, boring is the right choice.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript everywhere | One language for the market maker, the server and the screens; types catch money bugs early |
| App | Next.js (App Router), installable as a web app | Pages and server code in one project; a share link opens straight into it |
| Database and sign-in | Supabase: Postgres plus Auth with Google and email/password | Real transactions for trades, sign-in solved, a free tier, an EU region |
| Schema and queries | Drizzle ORM with migrations in the repo | Typed queries, and every schema change is a reviewable file |
| UI | Tailwind CSS with shadcn/ui components | Fast to build, easy for Claude Code to extend consistently |
| Tests | Vitest, plus fast-check for property tests | Unit tests for the maths, and random sequences of trades to prove coins are never created or lost |
| Hosting | Vercel for the app; Supabase Cron for the scheduled job | Deploys on every push, free for a personal project. Vercel's free plan only runs scheduled jobs once a day, too rarely for payouts, so the 15-minute job runs from the database |
| Errors | Sentry free tier *(optional)* | You hear about a crash before your friends tell you |

**Rule that shapes everything:** the browser never writes to the coin tables. Every action that moves coins (bet, sell, resolve, claim the drop) is a server function that runs in one database transaction. Row-level security in Supabase locks the rest, which is exactly the hole most vibe-coded Supabase apps leave open, so this doubles as practice for your security work.

## Architecture

&#91;embedded content: architecture · 4 parts\]

The browser talks only to the Next.js app. Anything that moves coins goes through a server function that opens one database transaction, calls the core, and commits or rolls back as a whole. A scheduled job does the time-based work: paying out after the 24-hour dispute window, cancelling markets nobody approved, and resetting the weekly leaderboard.

## Data model

Twelve tables cover the whole P0. Positions, balances and leaderboards are computed from the ledger and trades, never stored as editable numbers.

| Table | Holds | Notes |
| --- | --- | --- |
| `profiles` | First name, nickname, photo, role (member or admin) | One row per Supabase Auth user |
| `invites` | Code, who created it, who used it | Every member is traceable to the person who invited them |
| `markets` | Question, judging line, close date, status, creator, pool sizes | Status follows the lifecycle in the PRD |
| `market_tags` | Market, tagged member, approval status | A market stays hidden until every tag is approved |
| `trades` | Market, member, side, coins in or out, shares, price before and after | Append-only |
| `ledger` | Member, amount, reason (drop, bet, sale, payout, refund, bonus, fee), link to the trade or market | Append-only; a balance is the sum of a member's rows |
| `resolutions` | Market, proposed outcome, proof, proposed by, pays out at | One per market |
| `disputes` | Market, member, reason, ruling | One dispute sends the market to the admin |
| `comments` | Market, member, text |  |
| `reports` | What was reported, by whom, status |  |
| `admin_actions` | Admin, action, target, reason, time | Readable by every member |
| `daily_claims` | Member, date | A unique key on the pair stops a second claim |

**Two invariants, tested before any friend joins:**

1. **Conservation.** For every market, the coins players put in equal the coins paid out, refunded or kept in the pool, to the coin.
2. **No negative balance.** No sequence of actions can take a member's ledger sum below zero.

Both go in property tests that throw thousands of random sequences of bets, sales, resolutions and cancellations at the core and check the invariants after each one.

## Working with Claude Code

Claude Code writes the code. You make the product, design and gameplay calls, and you check that what it builds works. Two pieces need a closer eye because they hold everyone's coins.

### Setup, once

1. Install it: `curl -fsSL https://claude.ai/install.sh | bash`, then check with `claude --version` ([quickstart](https://code.claude.com/docs/en/quickstart.md)).
2. Create the project, `git init`, push it to a private GitHub repo, and run `claude` inside the folder.
3. Run `/init` to generate a starter `CLAUDE.md`, then cut it down to the version below.
4. Install the GitHub CLI (`gh`) so Claude Code can open pull requests.

### The CLAUDE.md

Keep it short. The [best-practices guide](https://code.claude.com/docs/en/best-practices.md) warns that a long file gets half-ignored; for each line, ask whether removing it would cause a mistake.

```markdown
# Poly'sen
Play-money prediction market for a friend group. Spec: docs/PRD.md

# Commands
- pnpm dev / pnpm test / pnpm typecheck / pnpm db:migrate

# Rules
- IMPORTANT: src/core/amm.ts and src/core/ledger.ts hold the coin maths. Change them only after Mael approves a plan, and explain the maths in the pull request.
- Coins move only in server functions, inside one database transaction. Never from the browser.
- Every new table gets row-level security in the same migration.
- No secrets in code. Read them from .env.local.
- Run pnpm typecheck and pnpm test before saying a task is done.

# Docs
- Record any real design choice in docs/decisions/ (one short file each).
```

### The loop for every feature

1. **Fresh session.** Run `/clear` between features, so old context doesn't leak in.
2. **Plan first.** Press `Shift+Tab` until plan mode is on, point Claude at the PRD section, and ask for a plan. Edit the plan before approving it.
3. **Tests first.** You write the test cases in plain words, Claude turns them into tests and makes them pass. Never let it write both the code and the only test that judges it.
4. **Implement and verify.** Ask Claude to run typecheck and tests and to show you the output, not just say it passed.
5. **Review.** Read the diff. Run `/code-review` for a fresh-context check, and reject anything you can't explain.
6. **Commit.** One feature, one pull request, merged by you.

If you correct Claude twice on the same thing, stop: `/clear` and start again with a better prompt. That advice comes straight from the guide, and it saves more time than any trick.

### What you own

You write no code, but three things stay yours, because a bug in the coin maths silently creates or destroys coins for everyone and no friend will notice until the leaderboard is nonsense.

- **The rules.** Coin amounts, how prices should move, what a fair payout is. Claude Code implements them; you decide them.
- **The test cases for the core.** Say in plain words what must always be true (the two invariants, and cases like "buying then selling straight back returns what you paid"). Claude turns them into tests. Never let it write both the code and the only test that judges it.
- **The final read of every change to `src/core/`.** Ask Claude to walk you through the diff and the maths until you could explain it to a friend, then merge.

### Habits that keep you in control

- A short file in `docs/decisions/` for every real product or design choice. Claude can draft it; you edit it so the reasoning is yours.
- Five lines in `JOURNAL.md` at the end of each phase: what shipped, what surprised you, what's next.
- Before invites open, ask Claude Code to quiz you on how one bet travels from the button to the database. If you can't answer, ask it to explain until you can.

## Build order

Five phases, one slice of the PRD each. Each phase ends with something you can try on your phone, and the "done when" column is the check. A phase is finished when its check passes, not on a date.

| Phase | Build | Done when |
| --- | --- | --- |
| 1 · Foundations, beside the paper test | Repo, Supabase dev project, Next.js scaffold, CLAUDE.md, tests running on every push. **The market maker and the ledger rules first, with property tests from your test case**s | The two invariants hold over 10,000 random sequences of trades |
| 2 · Sign-in and wallet | Sign-in (Google, email and password), invite links, profiles, the ledger table, wallet, daily drop | A test friend joins from your link and claims the drop; a second claim is refused |
| 3 · Markets and trading | Create a market, tag and approve, buy and sell through server functions | Two test accounts trade on one market, and the prices match what your core predicts |
| 4 · The playable app | Market page with chart and comments, home screen with the friends feed, portfolio, leaderboard | You can play a whole day on your phone without opening the database |
| 5 · Resolution, admin, launch | Resolution, disputes, payout job, admin page, share links with previews, privacy note, production deploy | One market goes from creation to payout with no manual step but your ruling, and every P0 box in the PRD is ticked |

The founding ten join once phase 5 is done.

### Starting prompts

Each phase starts in plan mode with a prompt like these. Paste the relevant PRD section, or keep the PRD in the repo as `docs/PRD.md` (the PRD doc exports to Markdown).

**Phase 2, sign-in:**

```text
Read the "Sign-up by invitation" section of docs/PRD.md. Plan how to build
invite links and sign-in with Supabase Auth, using Google and email/password.
List the tables, row-level security policies, pages and server functions you
would add. Don't write code yet.
```

**Phase 3, buying shares:**

```text
Implement the buy server function from the PRD. It must call buyShares from
src/core/amm.ts, lock the market row, write the trade and ledger rows and
update the pools in one transaction. Write tests for: not enough coins, a
closed market, and two bets arriving at the same moment. Run the tests and
show me the output.
```

**Phase 5, the payout job:**

```text
Write the route the scheduled job calls every 15 minutes. It pays out every
resolution older than 24 hours with no open dispute, and cancels markets
that waited 48 hours for approval. It must be safe to run twice in a row.
Protect the route with a secret header. Add tests, run them, show me.
```

## Testing, security and deployment

### Tests

| Layer | What | Tool |
| --- | --- | --- |
| Core | Prices, buying, selling, payouts, and the two invariants over random sequences | Vitest with fast-check |
| Server functions | Each coin-moving action against a local database, including refusals and two requests at once | Vitest with the Supabase local stack (`supabase start`) |
| Whole app *(optional)* | One happy path: sign up, bet, resolve, get paid | Playwright |

To stop Claude Code ending a turn on failing tests, ask it to write a Stop hook that runs `pnpm typecheck && pnpm test`. The [best-practices guide](https://code.claude.com/docs/en/best-practices.md) recommends hooks for checks that must run every time.

### Security

- **Row-level security on every table, from the first migration.** Then attack it yourself: with a second account and the public key, try to read someone else's ledger or write to the trades table straight from the browser console. Both must fail.
- **The secret key never reaches the browser.** Only server code reads it, from environment variables.
- **Two Supabase projects.** Claude Code only ever gets the dev project's keys; production keys live in Vercel's settings.
- **Read every migration yourself** before it runs on production.
- **Run `/security-review`** in Claude Code before invites open, then fix or explain each finding.

This is the same class of bug your security flagship studies, found on your own app first.

### Deployment

1. **Supabase:** dev and production projects in an EU region. Turn on Google sign-in in the auth settings.
2. **Vercel:** link the GitHub repo. Every pull request gets a preview link; merging into `main` deploys production.
3. **Scheduled job:** in the production database, a Supabase Cron job calls your protected payout route every 15 minutes through pg\_net ([Supabase docs](https://supabase.com/docs/guides/database/extensions/pgnet)).
4. **Domain** *(optional)*: a cheap domain makes share links look trustworthy in the group chat.

Two free-tier notes: Vercel's Hobby plan only runs its own scheduled jobs once a day ([Vercel docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)), which is why the job lives in Supabase; and a Supabase free project pauses after a stretch with no activity, which daily players will prevent but a holiday break might not. Check it before term restarts.

## Day one

About three hours, ending with a project that builds, tests that run, and the first piece of your core.

- [ ] Create a private GitHub repo named `polysen` and a Supabase dev project in an EU region.
- [ ] Run `claude` in an empty `polysen` folder and ask it to scaffold a Next.js app with TypeScript, Tailwind and the App Router, then push it.
- [ ] Run `/init`. Replace the generated file with the CLAUDE.md above, and save the PRD as `docs/PRD.md`.
- [ ] In plan mode, send: *"Set up Vitest, fast-check, Drizzle connected to Supabase, shadcn/ui, and a GitHub Action that runs typecheck and tests on every push. No app features."* Edit the plan, approve it, check that `pnpm test` runs, commit.
- [ ] Write your test cases for the market maker in plain words and give them to Claude:
  - buying YES raises the YES price;
  - the price always stays between 0 and 1;
  - buying shares and selling them straight back returns exactly the coins you paid;
  - no bet can take more coins out of a pool than it holds.
- [ ] In plan mode, ask it to build `src/core/amm.ts` as a constant-product market maker (the design Manifold uses) that passes those tests. Have it walk you through the maths before you approve the merge.
- [ ] Ask Claude to draft `docs/decisions/001-market-maker.md`, edit it in your words, and add your first five lines to `JOURNAL.md`.

Then run the paper test with your founders while the core settles.
