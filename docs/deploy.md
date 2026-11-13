# Going live (phase 5d)

The steps that need Mael's accounts, in order. Claude prepares everything else. Do each step once, and tick it off.

## 1. Supabase production project
- [ ] Create a second project, **Polysen-prod**, in an EU region (Paris `eu-west-3` if offered, otherwise Frankfurt). Never give its keys to Claude.
- [ ] Apply the migrations from your machine, after reading each one:
  `npx supabase link --project-ref <prod-ref>` then `npx supabase db push`.
- [ ] **Authentication → URL configuration:**
  - Site URL: `https://<your domain>`;
  - Redirect URLs: `https://<your domain>/**`, plus `https://*-<vercel-team>.vercel.app/**` for preview deploys.
- [ ] **Authentication → Email:** keep "Confirm email" on. The confirmation link comes back through `/auth/callback`.
- [ ] **Authentication → Providers → Google:** paste the client id and secret from step 3.
- [ ] Check that account deletion can write the `auth` schema (decision 016). In the SQL editor:
  `select has_table_privilege('postgres', 'auth.users', 'UPDATE'), has_table_privilege('postgres', 'auth.identities', 'DELETE'), has_table_privilege('postgres', 'auth.sessions', 'DELETE');`
  All three must be `true`. If not, tell Claude: deletion switches to the admin API.

## 2. Vercel
- [ ] Import the GitHub repo. Framework: Next.js.
- [ ] Set **Settings → Functions → Region** to the one closest to the database (`cdg1` for Paris, `fra1` for Frankfurt).
- [ ] Environment variables (Production, and Preview if previews should work):

  | Name | Value |
  | --- | --- |
  | `DATABASE_URL` | the **transaction pooler** string (port 6543) from Supabase → Connect |
  | `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-ref>.supabase.co` |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key |
  | `CRON_SECRET` | `openssl rand -hex 32` (keep it for step 4) |
  | `GOOGLE_SIGN_IN` | `on`, once step 3 is done |
- [ ] Deploy, open the site and sign up with your own e-mail.

## 3. Google sign-in
- [ ] Google Cloud console → new project "Poly'sen" → OAuth consent screen (External, app name Poly'sen, your e-mail).
- [ ] Credentials → OAuth client ID → Web application:
  - Authorised JavaScript origins: `https://<your domain>`;
  - Authorised redirect URI: `https://<prod-ref>.supabase.co/auth/v1/callback`.
- [ ] Paste the id and secret into Supabase (step 1), then set `GOOGLE_SIGN_IN=on` in Vercel and redeploy.

## 4. The payout job (every 15 minutes, from the database)
Vercel's free plan runs scheduled jobs once a day only, so the job runs from Supabase Cron (see the build plan). In the prod SQL editor:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
select cron.schedule('polysen-tick', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://<your domain>/api/tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
$$);
```
- [ ] After 15 minutes, `select status_code, content from net._http_response order by created desc limit 3;` should show `200` and `{"paid":…}`.

## 5. First admin and the founding ten
- [ ] With `DATABASE_URL` pointing at prod **only for this command**: `pnpm bootstrap-admin <your e-mail> <prénom> <pseudo>`.
- [ ] Make a backup admin later with the SQL from decision 014.
- [ ] Run `/security-review` in Claude Code before sending the first invite (build plan).
- [ ] Share your invite link from the wallet page.

## Free-tier watch
- A Supabase free project pauses after a week with no activity: check it after holidays.
- The job's logs live in `net._http_response`. A string of 401s means the secret in the vault and the one in Vercel differ.
