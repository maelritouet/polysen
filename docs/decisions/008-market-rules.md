# 008 · Market limits, selling and the content rules

**Status:** accepted, 2026-11-11 (Mael's answers at the start of phase 3).

## Decision
- **Close date:** at least 1 hour and at most 3 months after creation.
- **Minimum bet:** 1 coin. The bet input takes whole coins.
- **Selling:** the trade sheet has a percentage slider (with 25 / 50 / 100% shortcuts) over the shares held, plus a one-tap « Tout vendre ». The server receives a share count. « Tout vendre » sends exactly the shares held, so nothing is left over.
- **Content rules at creation:** one line with no link, plus a required checkbox:
  « Un marché ne doit blesser personne : personne nommée sans son accord, aucun sujet sensible, aucun pari qu'on gagne en se mettant en danger. »
  « J'accepte les règles. »
- **Market links:** plain `/marches/[id]` for members in phase 3. The invite parameter and link previews come in phase 5.

## Why
- A 1-hour minimum allows markets about tonight. A 3-month maximum keeps coins from sitting in a market past the season.
- Players think in "half my position" more easily than in share counts.
