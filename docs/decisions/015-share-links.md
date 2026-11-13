# 015 · Share links and public previews

**Status:** accepted. The rule is the PRD's ("Sharing"); the privacy limits are Claude's calls and can change.

## Decision
- **Every market has a share link:** `/m/<id>?invite=<my code>`. The « Partager » button on the market page builds it with the sharer's own invite code, and opens the phone's share sheet (or copies the link).
- **A member** who opens it is sent straight to `/marches/<id>`.
- **Anyone else** sees a public preview and a « Rejoindre et parier » button. It goes through the sharer's invitation (`/invitation/<code>?marche=<id>`), and after sign-up the newcomer lands on that market.
- **What the public preview shows:** the question, the odds (or the result), and the close date. Never a member's name, not even the creator's.
- **Which markets get a preview:** only open or resolved markets that nobody reported and that **name nobody**. Every other market (tagged, pending, cancelled, hidden, or unknown) gets the same generic card: "Un pari t'attend". So a link never reveals whether a hidden market exists.
- The preview image (`opengraph-image`) follows the same rule. The page asks search engines not to index it.
- **Landing after sign-up:** a `polysen_landing` cookie holds the market id only, never a path, so a crafted link can't send anyone to another site.

## Why
- A market that names someone is that person's data (PRD "Personal data"). Their approval covers the group, not WhatsApp's link previews, which get cached outside our control.
- Showing no names keeps the game's people inside the group. The question itself is the creator's to share.
