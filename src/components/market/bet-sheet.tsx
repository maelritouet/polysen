"use client";

import { useEffect, useRef, useState } from "react";
import type { Side } from "@/core/amm";
import { LABEL, sideBg, TradeForm } from "./trade-form";
import { DESKTOP_QUERY, SELL_EVENT, useTrade } from "./use-trade";

interface Props {
  marketId: string;
  percent: number;
  balanceWhole: number;
  holds: Record<Side, boolean>;
  tradable: boolean;
  closedReason: string;
}

/** Phones: the fixed Oui / Non bar and the bottom sheet it opens. Hidden on desktop. */
export function BetSheet({ marketId, percent, balanceWhole, holds, tradable, closedReason }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [toast, setToast] = useState<string>();
  const trade = useTrade(marketId, (msg) => {
    dialog.current?.close();
    setToast(msg);
  });
  const { switchTo } = trade;

  useEffect(() => {
    if (!tradable) return;
    const onSell = (e: Event) => {
      if (window.matchMedia(DESKTOP_QUERY).matches) return; // the desktop panel handles it
      switchTo({ kind: "sell", side: (e as CustomEvent<Side>).detail });
      dialog.current?.showModal();
    };
    window.addEventListener(SELL_EVENT, onSell);
    return () => window.removeEventListener(SELL_EVENT, onSell);
  }, [tradable, switchTo]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const price: Record<Side, number> = { YES: percent, NO: 100 - percent };

  return (
    <div className="lg:hidden">
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-night/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {toast && (
            <p role="status" className="mb-2 text-center text-sm">
              {toast}
            </p>
          )}
          {tradable ? (
            <div className="grid grid-cols-2 gap-3">
              {(["YES", "NO"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    switchTo({ kind: "buy", side: s });
                    dialog.current?.showModal();
                  }}
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
        className="m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-black/60 open:animate-in open:slide-in-from-bottom-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close(); // tap outside closes
        }}
      >
        <div className="rounded-t-2xl border border-line bg-panel px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
          <TradeForm trade={trade} percent={percent} balanceWhole={balanceWhole} holds={holds} />
        </div>
      </dialog>
    </div>
  );
}
