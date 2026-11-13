/** How the home page orders markets. */
export const SORTS = [
  { key: "tendance", label: "Tendance" },
  { key: "nouveaux", label: "Nouveaux" },
  { key: "bientot", label: "Bientôt fermés" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

export function parseSort(value: unknown): SortKey {
  return SORTS.some((s) => s.key === value) ? (value as SortKey) : "tendance";
}

interface Sortable {
  createdAt: Date;
  closeAt: Date;
  volume24h: bigint;
  volume: bigint;
}

/**
 * Tendance: most coins traded in the last 24 h, then all-time volume, then
 * newest. Nouveaux: newest first. Bientôt fermés: soonest close first.
 */
export function sortMarkets<T extends Sortable>(markets: T[], sort: SortKey): T[] {
  const byNew = (a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime();
  const cmp = (x: bigint, y: bigint) => (x === y ? 0 : x > y ? -1 : 1);
  const rules: Record<SortKey, (a: T, b: T) => number> = {
    tendance: (a, b) => cmp(a.volume24h, b.volume24h) || cmp(a.volume, b.volume) || byNew(a, b),
    nouveaux: byNew,
    bientot: (a, b) => a.closeAt.getTime() - b.closeAt.getTime(),
  };
  return [...markets].sort(rules[sort]);
}

/** Open markets closing within the next 48 hours, soonest first. */
export function closingSoon<T extends Sortable & { status: string }>(markets: T[], now: number, limit = 8): T[] {
  return markets
    .filter((m) => m.status === "open" && m.closeAt.getTime() > now && m.closeAt.getTime() - now <= 48 * 3_600_000)
    .sort((a, b) => a.closeAt.getTime() - b.closeAt.getTime())
    .slice(0, limit);
}
