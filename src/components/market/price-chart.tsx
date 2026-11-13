"use client";

import { useId, useMemo, useState } from "react";
import type { PricePoint } from "@/server/history";

const RANGES = [
  { key: "1J", label: "1J", ms: 86_400_000 },
  { key: "1S", label: "1S", ms: 7 * 86_400_000 },
  { key: "TOUT", label: "Tout", ms: Infinity },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const W = 600;
const H = 220;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;

const pct = (p: number) => Math.min(99, Math.max(1, Math.round(p * 100)));

const DATE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * The market's big number and its price history. Step line (a price holds
 * until the next trade), y-axis fitted to the visible range, scrub to read
 * any past moment. `now` comes from the server render so the drawing is
 * stable between server and browser.
 */
export function PriceChart({ points, now, end }: { points: PricePoint[]; now: number; end: number }) {
  const gradientId = useId();
  const glowId = useId();
  const [range, setRange] = useState<RangeKey>("TOUT");
  const [hover, setHover] = useState<{ x: number; p: number; t: number } | null>(null);

  const view = useMemo(() => {
    const last = Math.min(now, end);
    const span = RANGES.find((r) => r.key === range)!.ms;
    const from = Math.max(points[0]?.t ?? last, last - span);
    // The price at `from`, then every change after it, then hold to the end.
    let start = points[0]?.p ?? 0.5;
    for (const pt of points) if (pt.t <= from) start = pt.p;
    const pts: PricePoint[] = [{ t: from, p: start }, ...points.filter((pt) => pt.t > from && pt.t <= last), { t: last, p: 0 }];
    pts[pts.length - 1].p = pts[pts.length - 2].p;

    const ps = pts.map((pt) => pt.p);
    let lo = Math.min(...ps);
    let hi = Math.max(...ps);
    const mid = (lo + hi) / 2;
    const half = Math.max((hi - lo) / 2 + 0.04, 0.1); // never zoom in tighter than ±10 pts
    lo = Math.max(0, mid - half);
    hi = Math.min(1, mid + half);

    const t0 = from;
    const t1 = Math.max(last, from + 1);
    const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
    const y = (p: number) => PAD_TOP + (1 - (p - lo) / (hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);

    let d = `M ${x(pts[0].t)} ${y(pts[0].p)}`;
    for (let i = 1; i < pts.length; i++) d += ` H ${x(pts[i].t)} V ${y(pts[i].p)}`;
    const area = `${d} V ${H} H 0 Z`;

    const ticks = [0.25, 0.5, 0.75].filter((v) => v > lo + 0.02 && v < hi - 0.02);
    return { pts, d, area, x, y, t0, t1, ticks, startP: start, lastP: pts[pts.length - 1].p };
  }, [points, now, end, range]);

  const shown = hover ?? { p: view.lastP, t: Math.min(now, end), x: W };
  const delta = pct(shown.p) - pct(view.startP);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const t = view.t0 + fx * (view.t1 - view.t0);
    let p = view.pts[0].p;
    for (const pt of view.pts) if (pt.t <= t) p = pt.p;
    setHover({ x: fx * W, p, t });
  }

  return (
    <section aria-label="Évolution de la probabilité">
      <div className="flex items-end justify-between gap-4">
        <p className="leading-none">
          <span className="text-6xl font-extrabold tracking-tight text-yes">{pct(shown.p)}</span>
          <span className="ml-1 text-2xl font-bold text-yes">%</span>
          <span className="ml-2 text-sm text-dim">de chances que ce soit oui</span>
        </p>
      </div>
      <p className="mt-2 h-5 text-sm">
        {hover ? (
          <span className="text-dim">{DATE.format(shown.t)}</span>
        ) : (
          <span className={delta > 0 ? "text-yes" : delta < 0 ? "text-no" : "text-dim"}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta)} pts
            <span className="text-dim"> {range === "1J" ? "sur 24 h" : range === "1S" ? "sur 7 jours" : "depuis l'ouverture"}</span>
          </span>
        )}
      </p>

      <div className="relative mt-3 h-52">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Probabilité actuelle : ${pct(view.lastP)} %`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--yes)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--yes)" stopOpacity="0" />
            </linearGradient>
            <filter id={glowId} x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          {view.ticks.map((v) => (
            <line key={v} x1="0" x2={W} y1={view.y(v)} y2={view.y(v)} stroke="var(--line)" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={view.area} fill={`url(#${gradientId})`} />
          <path d={view.d} fill="none" stroke="var(--yes)" strokeWidth="6" opacity="0.45" filter={`url(#${glowId})`} vectorEffect="non-scaling-stroke" />
          <path d={view.d} fill="none" stroke="var(--yes)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {hover && <line x1={hover.x} x2={hover.x} y1="0" y2={H} stroke="var(--dim)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* Labels and the dot live in HTML, so the stretched SVG never distorts them. */}
        {view.ticks.map((v) => (
          <span
            key={v}
            className="pointer-events-none absolute right-0 -translate-y-full pb-0.5 text-[11px] text-dim"
            style={{ top: `${(view.y(v) / H) * 100}%` }}
          >
            {Math.round(v * 100)} %
          </span>
        ))}
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yes bg-night"
          style={{ left: `${(shown.x / W) * 100}%`, top: `${(view.y(shown.p) / H) * 100}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex gap-1" role="tablist" aria-label="Période">
        {RANGES.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={range === r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-md px-3 py-1 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              range === r.key ? "bg-secondary text-foreground" : "text-dim hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </section>
  );
}
