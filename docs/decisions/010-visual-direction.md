# 010 · Visual direction: night trading floor

**Status:** accepted, 2026-11-11 (Mael picked it from three directions).

## Decision
- **Theme:** Poly'sen is dark only.
- **Colours:**
  - background `#0F1B2D`, panels `#16263D`, lines `#24384F`;
  - text `#E8EEF6`, muted text `#8DA0B8`;
  - **oui** mint `#3BE0A0`, **non** coral `#FF6B6B`. These two always mean oui and non, and are never used as decoration.
- **Type:** Manrope everywhere, with tabular figures so the numbers don't jitter.
- **Market page:** Polymarket-style:
  - the probability and its change;
  - a step-line price chart (1J / 1S / Tout, scrub to read the past);
  - a fixed Oui / Non bar that opens a bottom sheet showing the payout and gain *as minimums* (decision 007).
- **The chart is hand-drawn SVG** (`src/components/market/price-chart.tsx`), not Recharts. It gives full control over the glow and scrub with no new dependency. Its labels and dot are HTML overlays, so the stretched SVG never distorts them.

## Why
Mael found the first UI too plain and wanted a trading view like Polymarket. A serious trading-floor look makes the group's silly questions funnier.
