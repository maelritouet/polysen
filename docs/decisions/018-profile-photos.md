# 018 · Profile photos

**Status:** accepted (Claude's call, can change). PRD P0 #1: "The profile holds a first name, a nickname and a photo, and shows them on every bet and market."

## Decision
- **Optional.** A member adds or changes a photo on the wallet page. Without one, everyone sees their initials in a coloured circle.
- **Stored in Postgres** (`avatars`: one 256×256 WebP per member, at most 200 KB, usually about 10 KB), not in a Storage bucket. At 10–50 members that is under 1 MB in total. It needs no bucket policies and no service key, and the rule "the browser never queries the database" still holds. RLS is deny-all, like every table.
- **Re-encoded by the server** with `sharp`: cropped square around the most interesting area, resized, saved as WebP. Re-encoding drops all metadata, including the GPS position phones write into photos. A file that isn't really an image is refused. The browser shrinks the photo first only to keep the upload small (server actions accept 1 MB).
- **Served by `/photo/<member id>` to signed-in members only.** It is never on the public share preview (decision 015). The browser caches it for 5 minutes, and no shared cache keeps it. Other members may see an old photo for up to 5 minutes after a change.
- **Shown** next to names in the feed, a market's creator line, its bets and comments, and the leaderboard.
- **Deleted** with the account (decision 016).

## Why
- The cheapest design that keeps photos private to the group and keeps location data out of them.
- Google's profile picture could pre-fill it later, once Google sign-in is live.
