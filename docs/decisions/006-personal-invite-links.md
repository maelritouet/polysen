# 006 · Invites: one personal link per member

**Status:** accepted, 2026-11-10 (chosen by Mael)

## Decision
Every member has one permanent invite code, carried in every link they share (`/invitation/CODE`). Anyone who signs up through it joins, and the app records that member as their inviter. A member can generate a new code at any time; links with the old one stop working.

The very first member, the admin, has no inviter and is created once from the command line: `pnpm bootstrap-admin <email> <first name> <nickname>`.

## Why
The PRD wants a market link dropped in the group chat to double as an invitation, so one link is seen by many people. Single-use codes would break that. Traceability (who brought whom) is what stops second accounts, and personal links keep it.

## Alternatives rejected
- Single-use codes: tighter, but no group-chat sharing.
- Personal link with a cap per season: possible later if a link leaks too widely; rotating the code covers that for now.

## Also decided for phase 2
- Sign-in is email + password only for now; Google sign-in comes before invites open (phase 5), as the PRD allows.
- The profile photo moves to phase 4, where profiles are displayed.
