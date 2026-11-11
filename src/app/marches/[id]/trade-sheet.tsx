"use client";

import { useEffect, useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Side } from "@/core/amm";
import {
  buyAction,
  quoteBuyAction,
  quoteSellAction,
  sellAction,
  type BuyQuote,
  type SellQuote,
} from "../actions";

const LABEL: Record<Side, string> = { YES: "OUI", NO: "NON" };

interface Props {
  marketId: string;
  balance: string;
  holds: Record<Side, boolean>;
}

/**
 * Buy or sell, with the outcome shown before confirming. Each confirm carries
 * a request id generated once: a double tap or a retry never trades twice.
 */
export function TradeSheet({ marketId, balance, holds }: Props) {
  const canSell = holds.YES || holds.NO;
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [side, setSide] = useState<Side>("YES");
  const [sellSide, setSellSide] = useState<Side>(holds.YES ? "YES" : "NO");
  const [amount, setAmount] = useState("10");
  const [percent, setPercent] = useState(100);
  const [quote, setQuote] = useState<BuyQuote | SellQuote | null>(null);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const selling = mode === "sell" && canSell;

  // Fresh quote after each change, debounced.
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const q = selling ? await quoteSellAction(marketId, sellSide, percent) : await quoteBuyAction(marketId, side, amount);
      if (live) setQuote(q);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [marketId, selling, side, sellSide, amount, percent]);

  function confirm() {
    start(async () => {
      const r = selling
        ? await sellAction(marketId, sellSide, percent, requestId)
        : await buyAction(marketId, side, amount, requestId);
      setResult(r);
      if ("ok" in r) {
        setRequestId(crypto.randomUUID()); // the next confirm is a new trade
        if (selling) setPercent(100);
      }
    });
  }

  const toggle = (active: boolean) => (active ? "default" : "outline");

  return (
    <Card>
      <CardHeader>
        <CardDescription>Ton solde : {balance} pièces</CardDescription>
        <CardTitle className="flex gap-2">
          <Button size="sm" variant={toggle(!selling)} onClick={() => setMode("buy")}>
            Parier
          </Button>
          {canSell && (
            <Button size="sm" variant={toggle(selling)} onClick={() => setMode("sell")}>
              Vendre
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!selling ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(["YES", "NO"] as const).map((s) => (
                <Button key={s} variant={toggle(side === s)} onClick={() => setSide(s)}>
                  {LABEL[s]}
                </Button>
              ))}
            </div>
            <label className="flex flex-col gap-2 text-sm">
              Mise (pièces)
              <Input inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
            </label>
            {quote && "shares" in quote && (
              <p className="text-sm">
                Tu reçois <b>{quote.shares} parts {LABEL[side]}</b>. Le marché passe à <b>{quote.percentAfter} %</b>.
                <br />
                Gain si tu as raison : <b>au moins {quote.payoutAtLeast} pièces</b>.
              </p>
            )}
          </>
        ) : (
          <>
            {holds.YES && holds.NO && (
              <div className="grid grid-cols-2 gap-2">
                {(["YES", "NO"] as const).map((s) => (
                  <Button key={s} variant={toggle(sellSide === s)} onClick={() => setSellSide(s)}>
                    Mes parts {LABEL[s]}
                  </Button>
                ))}
              </div>
            )}
            <label className="flex flex-col gap-2 text-sm">
              Vendre {percent} % de mes parts {LABEL[sellSide]}
              <input type="range" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[25, 50, 100].map((p) => (
                <Button key={p} size="sm" variant={toggle(percent === p)} onClick={() => setPercent(p)}>
                  {p === 100 ? "Tout vendre" : `${p} %`}
                </Button>
              ))}
            </div>
            {quote && "proceeds" in quote && (
              <p className="text-sm">
                Tu reçois <b>{quote.proceeds} pièces</b>. Le marché passe à <b>{quote.percentAfter} %</b>.
              </p>
            )}
          </>
        )}
        {quote && "error" in quote && <FormMessage error={quote.error} />}
        <Button disabled={pending || !quote || "error" in quote} onClick={confirm}>
          {selling ? "Confirmer la vente" : `Parier ${amount || 0} pièces sur ${LABEL[side]}`}
        </Button>
        <FormMessage error={result.error} ok={result.ok} />
      </CardContent>
    </Card>
  );
}
