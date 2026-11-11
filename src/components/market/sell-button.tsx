"use client";

import type { Side } from "@/core/amm";
import { SELL_EVENT } from "./use-trade";

/** Opens the trade UI (phone sheet or desktop panel) in sell mode for one side of the position. */
export function SellButton({ side }: { side: Side }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent(SELL_EVENT, { detail: side }))}
      className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      Vendre
    </button>
  );
}
