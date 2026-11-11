# 012 · Comments, the insider badge and the installable app

**Status:** accepted (Claude's calls within the approved phase 4 plan; open to change).

## Decision
- **Comments** live in their own table, `comments`, with row-level security on and no policies, like every table. Reads and writes go through server functions that apply the market visibility rule, so a market waiting for a tagged member's approval keeps its thread hidden too.
  - Up to 500 characters, and at most 5 messages per minute per member: a brake on spam, not on conversation.
  - Authors can delete their own message: the text disappears and the thread shows « Message supprimé ». Admin deletion and reports come with the admin page in phase 5.
  - Each message shows the side its author **holds now** (the bigger one if both), so you can tell talk from position.
- **Insider badge:** when the creator or a named member holds shares, the market page shows it publicly, with the side: « @lea (créateur) a parié non ». Trades are already public in the activity list, so showing the side reveals nothing new and helps most.
- **Installable app:** a web manifest and icons (a mint step chart on the night background), so members can add Poly'sen to their home screen and open it full screen. No service worker or offline mode: every screen needs live prices anyway. Push notifications are a later phase.

## Why
- The PRD asks for a comment thread and a public badge for insiders. Keeping the trash talk next to the bets is the point of the thread.
- Soft delete keeps reply context readable and leaves a trace for the admin.
- The manifest must load without a session (browsers fetch it without cookies), so it is the only public path added to the proxy.
