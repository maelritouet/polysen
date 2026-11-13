# 017 · One return address for Google and e-mail confirmation

**Status:** accepted (Claude's call, can change).

## Decision
- Supabase sends people back to **`/auth/callback?code=…&suivant=/path`** after Google sign-in and after they click the confirmation e-mail. The route swaps the one-time code for a session cookie (PKCE), then goes to `suivant`. `suivant` is checked by `safeNext`: same-site paths only.
- A bad or reused code lands on `/connexion?erreur=lien` with a plain message.
- A newcomer has no profile yet, so the usual check sends them to `/bienvenue`, where the invite and landing cookies are still waiting.
- The Google button shows only when `GOOGLE_SIGN_IN=on`, once the provider is set up in Supabase (docs/deploy.md). Until then, the button would only lead to an error.

## Why
- With `@supabase/ssr`, both flows come back with a `code` that only the server can exchange. Without this route, production sign-ups with "Confirm email" turned on would never get a session.
