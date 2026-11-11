import type { PricePoint } from "@/server/history";

/** A tiny step line of a market's price, coloured by its move over the window. */
export function Sparkline({ points, now }: { points: PricePoint[]; now: number }) {
  const W = 72;
  const H = 28;
  if (!points.length) return null;
  const from = points[0].t;
  const t1 = Math.max(now, from + 1);
  const ps = points.map((p) => p.p);
  const lo = Math.min(...ps, 0.4);
  const hi = Math.max(...ps, 0.6);
  const x = (t: number) => ((t - from) / (t1 - from)) * W;
  const y = (p: number) => 2 + (1 - (p - lo) / (hi - lo)) * (H - 4);
  let d = `M 0 ${y(points[0].p)}`;
  for (const pt of points.slice(1)) d += ` H ${x(pt.t)} V ${y(pt.p)}`;
  d += ` H ${W}`;
  const last = points[points.length - 1].p;
  const color = last > points[0].p + 0.005 ? "var(--yes)" : last < points[0].p - 0.005 ? "var(--no)" : "var(--dim)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-18 shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
