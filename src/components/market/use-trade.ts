"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { Side } from "@/core/amm";
import { buyAction, quoteBuyAction, quoteSellAction, sellAction, type BuyQuote, type SellQuote } from "@/app/marches/actions";

export type TradeMode = { kind: "buy"; side: Side } | { kind: "sell"; side: Side };

/** Fired by a position's "Vendre" button; the visible trade UI picks it up. */
export const SELL_EVENT = "polysen:sell";
export const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Everything a trade form needs: the mode, the stake or sell share, a live
 * debounced quote, and confirm. Each confirm carries one request id, renewed
 * only after a success, so a double tap or a retry never trades twice.
 */
export function useTrade(marketId: string, onDone: (message: string) => void) {
  const [mode, setMode] = useState<TradeMode>({ kind: "buy", side: "YES" });
  const [amount, setAmount] = useState("");
  const [sellPercent, setSellPercent] = useState(100);
  const [fetched, setFetched] = useState<BuyQuote | SellQuote | null>(null);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const selling = mode.kind === "sell";

  useEffect(() => {
    if (!selling && !amount) return;
    let live = true;
    const t = setTimeout(async () => {
      const q = selling ? await quoteSellAction(marketId, mode.side, sellPercent) : await quoteBuyAction(marketId, mode.side, amount);
      if (live) setFetched(q);
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [marketId, selling, mode.side, amount, sellPercent]);

  // A quote for another mode or side, or with no stake typed, must never show.
  const matches =
    fetched !== null && (selling ? "proceeds" in fetched || "error" in fetched : "shares" in fetched || "error" in fetched);
  const quote = !selling && !amount ? null : matches ? fetched : null;
  const quoteError = quote && "error" in quote ? quote.error : undefined;

  const switchTo = useCallback((m: TradeMode) => {
    setMode(m);
    setError(undefined);
    setFetched(null);
    if (m.kind === "sell") setSellPercent(100);
  }, []);

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
      setFetched(null);
      onDone(r.ok);
    });
  }

  return {
    mode,
    switchTo,
    amount,
    setAmount,
    sellPercent,
    setSellPercent,
    quote,
    problem: error ?? quoteError,
    canConfirm: !pending && quote !== null && !quoteError,
    pending,
    confirm,
  };
}

export type Trade = ReturnType<typeof useTrade>;
