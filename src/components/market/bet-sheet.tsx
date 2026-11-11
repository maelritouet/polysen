"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Side } from "@/core/amm";
import {
  buyAction,
  quoteBuyAction,
  quoteSellAction,
  sellAction,
  type BuyQuote,
  type SellQuote,
} from "@/app/marches/actions";

const LABEL: Record<Side, string> = { YES: "Oui", NO: "Non" };
const sideBg: Record<Side, string> = { YES: "bg-yes text-night", NO: "bg-no text-night" };
const sideText: Record<Side, string> = { YES: "text-yes", NO: "text-no" };

interface Props {
  marketId: string;
  /** YES probability, 1–99. */
  percent: number;
  /** Whole coins the member can spend. */
  balanceWhole: number;
  holds: Record<Side, boolean>;
  tradable: boolean;
  closedReason: string;
}

type Mode = { kind: "buy"; side: Side } | { kind: "sell"; side: Side };

/**
 * The fixed OUI / NON bar and the sheet that opens from it. The sheet shows
 * what the trade does before it's confirmed; each confirm carries one
 * request id, so a double tap or a retry never trades twice.
 */
export function BetSheet({ marketId, percent, balanceWhole, holds, tradable, closedReason }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>({ kind: "buy", side: "YES" });
  const [amount, setAmount] = useState("");
  const [sellPercent, setSellPercent] = useState(100);
  const [fetched, setQuote] = useState<BuyQuote | SellQuote | null>(null);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const selling = mode.kind === "sell";

  function open(m: Mode) {
    setMode(m);
    setError(undefined);
    setQuote(null);
    if (m.kind === "sell") setSellPercent(100);
    dialog.current?.showModal();
  }

  useEffect(() => {
    if (!tradable) return;
    const onOpenSell = (e: Event) => open({ kind: "sell", side: (e as CustomEvent<Side>).detail });
    window.addEventListener("polysen:sell", onOpenSell);
    return () => window.removeEventListener("polysen:sell", onOpenSell);
  }, [tradable]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Live quote, debounced.
  useEffect(() => {
    if (!selling && !amount) return;
    let live = true;
    const t = setTimeout(async () => {
      const q = selling ? await quoteSellAction(marketId, mode.side, sellPercent) : await quoteBuyAction(marketId, mode.side, amount);
      if (live) setQuote(q);
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [marketId, selling, mode.side, amount, sellPercent]);

  function confirm() {
    setError(undefined);
    start(async () => {
      const r = selling
        ? await sellAction(marketId, mode.side, sellPercent, requestId)
        : await buyAction(marketId, mode.side, amount, requestId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setRequestId(crypto.randomUUID()); // the next confirm is a new trade
      setAmount("");
      dialog.current?.close();
      setToast(r.ok);
    });
  }

  // No stake typed: nothing to quote (and a stale quote must not show).
  const quote = !selling && !amount ? null : fetched;
  const add = (n: number) => setAmount(String(Math.min(balanceWhole, (Number(amount) || 0) + n)));
  const price: Record<Side, number> = { YES: percent, NO: 100 - percent };
  const quoteError = quote && "error" in quote ? quote.error : undefined;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-night/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {toast && (
            <p role="status" className="mb-2 text-center text-sm text-ink">
              {toast}
            </p>
          )}
          {tradable ? (
            <div className="grid grid-cols-2 gap-3">
              {(["YES", "NO"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => open({ kind: "buy", side: s })}
                  className={`flex h-14 items-center justify-between rounded-xl px-4 text-lg font-extrabold transition-transform focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none active:scale-[0.98] ${sideBg[s]}`}
                >
                  <span>{LABEL[s]}</span>
                  <span className="tabular-nums">{price[s]} %</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-3 text-center text-sm text-dim">{closedReason}</p>
          )}
        </div>
      </div>

      <dialog
        ref={dialog}
        className="m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-black/60 open:animate-in open:slide-in-from-bottom-8 sm:mx-auto sm:max-w-xl"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close(); // tap outside closes
        }}
      >
        <div className="rounded-t-2xl border border-line bg-panel px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden="true" />

          {!selling ? (
            <>
              <h2 className="text-lg font-bold">Parier</h2>
              <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ton pronostic">
                {(["YES", "NO"] as const).map((s) => (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={mode.side === s}
                    onClick={() => setMode({ kind: "buy", side: s })}
                    className={`h-11 rounded-lg font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none ${
                      mode.side === s ? sideBg[s] : "bg-secondary text-dim"
                    }`}
                  >
                    {LABEL[s]} {price[s]} %
                  </button>
                ))}
              </div>
              <label className="mt-5 block text-sm text-dim" htmlFor="stake">
                Mise
              </label>
              <div className="mt-1 flex items-baseline gap-2 border-b border-line pb-2">
                <input
                  id="stake"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
                  className="w-full bg-transparent text-4xl font-extrabold tabular-nums outline-none placeholder:text-line"
                />
                <span className="text-dim">pièces</span>
              </div>
              <div className="mt-3 flex gap-2">
                {[10, 50, 100].map((n) => (
                  <button key={n} onClick={() => add(n)} className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    +{n}
                  </button>
                ))}
                <button onClick={() => setAmount(String(balanceWhole))} className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  Tout
                </button>
              </div>
              <dl className="mt-5 space-y-1.5 text-sm">
                {quote && "shares" in quote ? (
                  <>
                    <Row label="Si c'est oui" hide={mode.side !== "YES"} value={`au moins ${quote.payoutAtLeast} pièces`} strong={sideText.YES} />
                    <Row label="Gain" hide={mode.side !== "YES"} value={`${quote.gainAtLeast} au moins`} strong={sideText.YES} />
                    <Row label="Si c'est non" hide={mode.side !== "NO"} value={`au moins ${quote.payoutAtLeast} pièces`} strong={sideText.NO} />
                    <Row label="Gain" hide={mode.side !== "NO"} value={`${quote.gainAtLeast} au moins`} strong={sideText.NO} />
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
                      onClick={() => setMode({ kind: "sell", side: s })}
                      className={`h-10 rounded-lg font-bold ${mode.side === s ? sideBg[s] : "bg-secondary text-dim"}`}
                    >
                      Parts {LABEL[s]}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-5 text-4xl font-extrabold tabular-nums">{sellPercent} %</p>
              <input
                type="range"
                min={1}
                max={100}
                value={sellPercent}
                onChange={(e) => setSellPercent(Number(e.target.value))}
                aria-label="Part de ta position à vendre"
                className="mt-3 w-full accent-[var(--ink)]"
              />
              <div className="mt-3 flex gap-2">
                {[25, 50].map((n) => (
                  <button key={n} onClick={() => setSellPercent(n)} className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold">
                    {n} %
                  </button>
                ))}
                <button onClick={() => setSellPercent(100)} className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold">
                  Tout vendre
                </button>
              </div>
              <dl className="mt-5 space-y-1.5 text-sm">
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

          {(error ?? quoteError) && (
            <p role="alert" className="mt-3 text-sm text-no">
              {error ?? quoteError}
            </p>
          )}
          <button
            onClick={confirm}
            disabled={pending || !quote || Boolean(quoteError)}
            className={`mt-5 h-13 w-full rounded-xl text-base font-extrabold transition-opacity focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:opacity-40 ${sideBg[mode.side]}`}
          >
            {pending
              ? "Un instant…"
              : selling
                ? `Vendre ${sellPercent === 100 ? "tout" : `${sellPercent} %`}`
                : `Parier ${amount || 0} sur ${LABEL[mode.side].toLowerCase()}`}
          </button>
        </div>
      </dialog>
    </>
  );
}

function Row({ label, value, strong, hide }: { label: string; value: string; strong?: string; hide?: boolean }) {
  if (hide) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-dim">{label}</dt>
      <dd className={`font-semibold tabular-nums ${strong ?? ""}`}>{value}</dd>
    </div>
  );
}
