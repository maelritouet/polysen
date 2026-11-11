"use client";

import { useEffect, useState } from "react";
import type { Side } from "@/core/amm";
import { TradeForm } from "./trade-form";
import { DESKTOP_QUERY, SELL_EVENT, useTrade } from "./use-trade";

interface Props {
  marketId: string;
  percent: number;
  balanceWhole: number;
  holds: Record<Side, boolean>;
  tradable: boolean;
  closedReason: string;
}

/** Desktop: the trade form docked beside the chart. Hidden on phones. */
export function BetPanel({ marketId, percent, balanceWhole, holds, tradable, closedReason }: Props) {
  const [done, setDone] = useState<string>();
  const trade = useTrade(marketId, setDone);
  const { switchTo } = trade;

  useEffect(() => {
    if (!tradable) return;
    const onSell = (e: Event) => {
      if (!window.matchMedia(DESKTOP_QUERY).matches) return; // the phone sheet handles it
      switchTo({ kind: "sell", side: (e as CustomEvent<Side>).detail });
    };
    window.addEventListener(SELL_EVENT, onSell);
    return () => window.removeEventListener(SELL_EVENT, onSell);
  }, [tradable, switchTo]);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-6 rounded-2xl border border-line bg-panel p-5">
        {tradable ? (
          <>
            <TradeForm trade={trade} percent={percent} balanceWhole={balanceWhole} holds={holds} showModeTabs />
            {done && (
              <p role="status" className="mt-3 text-sm text-dim">
                {done}
              </p>
            )}
          </>
        ) : (
          <p className="text-dim">{closedReason}</p>
        )}
      </div>
    </aside>
  );
}
