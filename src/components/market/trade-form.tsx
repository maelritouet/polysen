"use client";

import type { Side } from "@/core/amm";
import type { Trade } from "./use-trade";

export const LABEL: Record<Side, string> = { YES: "Oui", NO: "Non" };
export const sideBg: Record<Side, string> = { YES: "bg-yes text-night", NO: "bg-no text-night" };
const sideText: Record<Side, string> = { YES: "text-yes", NO: "text-no" };
const chip = "rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

interface Props {
  trade: Trade;
  /** YES probability, 1–99. */
  percent: number;
  balanceWhole: number;
  holds: Record<Side, boolean>;
  /** Shows the buy / sell switch (desktop panel). The phone sheet opens straight into one mode. */
  showModeTabs?: boolean;
}

/** The trade form shared by the phone sheet and the desktop panel. */
export function TradeForm({ trade, percent, balanceWhole, holds, showModeTabs }: Props) {
  const { mode, quote } = trade;
  const selling = mode.kind === "sell";
  const canSell = holds.YES || holds.NO;
  const price: Record<Side, number> = { YES: percent, NO: 100 - percent };
  const add = (n: number) => trade.setAmount(String(Math.min(balanceWhole, (Number(trade.amount) || 0) + n)));

  return (
    <div>
      {showModeTabs && canSell && (
        <div className="mb-4 flex gap-1" role="tablist" aria-label="Acheter ou vendre">
          {(["buy", "sell"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={mode.kind === k}
              onClick={() => trade.switchTo({ kind: k, side: k === "sell" ? (holds.YES ? "YES" : "NO") : mode.side })}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${mode.kind === k ? "bg-secondary text-ink" : "text-dim hover:text-ink"}`}
            >
              {k === "buy" ? "Parier" : "Vendre"}
            </button>
          ))}
        </div>
      )}

      {!selling ? (
        <>
          {!showModeTabs && <h2 className="mb-3 text-lg font-bold">Parier</h2>}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ton pronostic">
            {(["YES", "NO"] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={mode.side === s}
                onClick={() => trade.switchTo({ kind: "buy", side: s })}
                className={`h-12 rounded-lg text-base font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                  mode.side === s ? sideBg[s] : "bg-secondary text-dim hover:text-ink"
                }`}
              >
                {LABEL[s]} {price[s]} %
              </button>
            ))}
          </div>
          <label className="mt-5 block text-sm text-dim" htmlFor={`stake-${showModeTabs ? "panel" : "sheet"}`}>
            Mise
          </label>
          <div className="mt-1 flex items-baseline gap-2 border-b border-line pb-2">
            <input
              id={`stake-${showModeTabs ? "panel" : "sheet"}`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={trade.amount}
              onChange={(e) => trade.setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
              className="w-full bg-transparent text-4xl font-extrabold tabular-nums outline-none placeholder:text-line"
            />
            <span className="text-dim">pièces</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[10, 50, 100].map((n) => (
              <button key={n} onClick={() => add(n)} className={chip}>
                +{n}
              </button>
            ))}
            <button onClick={() => trade.setAmount(String(balanceWhole))} className={chip}>
              Tout
            </button>
          </div>
          <dl className="mt-5 min-h-24 space-y-1.5 text-sm">
            {quote && "shares" in quote ? (
              <>
                <Row label={`Si c'est ${LABEL[mode.side].toLowerCase()}`} value={`au moins ${quote.payoutAtLeast} pièces`} strong={sideText[mode.side]} />
                <Row label="Gain" value={`${quote.gainAtLeast} au moins`} strong={sideText[mode.side]} />
                <Row label="Parts reçues" value={quote.shares} />
                <Row label="Nouvelle probabilité" value={`${quote.percentAfter} %`} />
              </>
            ) : (
              <p className="text-dim">Choisis une mise pour voir ton gain possible.</p>
            )}
          </dl>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold">
            Vendre mes parts <span className={sideText[mode.side]}>{LABEL[mode.side]}</span>
          </h2>
          {holds.YES && holds.NO && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["YES", "NO"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => trade.switchTo({ kind: "sell", side: s })}
                  className={`h-10 rounded-lg font-bold ${mode.side === s ? sideBg[s] : "bg-secondary text-dim"}`}
                >
                  Parts {LABEL[s]}
                </button>
              ))}
            </div>
          )}
          <p className="mt-5 text-4xl font-extrabold tabular-nums">{trade.sellPercent} %</p>
          <input
            type="range"
            min={1}
            max={100}
            value={trade.sellPercent}
            onChange={(e) => trade.setSellPercent(Number(e.target.value))}
            aria-label="Part de ta position à vendre"
            className="mt-3 w-full accent-[var(--ink)]"
          />
          <div className="mt-3 flex gap-2">
            {[25, 50].map((n) => (
              <button key={n} onClick={() => trade.setSellPercent(n)} className={chip}>
                {n} %
              </button>
            ))}
            <button onClick={() => trade.setSellPercent(100)} className={chip}>
              Tout vendre
            </button>
          </div>
          <dl className="mt-5 min-h-12 space-y-1.5 text-sm">
            {quote && "proceeds" in quote ? (
              <>
                <Row label="Tu reçois" value={`${quote.proceeds} pièces`} strong="text-ink" />
                <Row label="Nouvelle probabilité" value={`${quote.percentAfter} %`} />
              </>
            ) : (
              <p className="text-dim">Calcul du prix…</p>
            )}
          </dl>
        </>
      )}

      {trade.problem && (
        <p role="alert" className="mt-3 text-sm text-no">
          {trade.problem}
        </p>
      )}
      <button
        onClick={trade.confirm}
        disabled={!trade.canConfirm}
        className={`mt-5 h-13 w-full rounded-xl text-base font-extrabold transition-opacity focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:opacity-40 ${sideBg[mode.side]}`}
      >
        {trade.pending
          ? "Un instant…"
          : selling
            ? `Vendre ${trade.sellPercent === 100 ? "tout" : `${trade.sellPercent} %`}`
            : `Parier ${trade.amount || 0} sur ${LABEL[mode.side].toLowerCase()}`}
      </button>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-dim">{label}</dt>
      <dd className={`font-semibold tabular-nums ${strong ?? ""}`}>{value}</dd>
    </div>
  );
}
