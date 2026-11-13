"use client";

import type { Side } from "@/core/amm";

/** Opens the bet sheet in sell mode for one side of the member's position. */
export function SellButton({ side }: { side: Side }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("polysen:sell", { detail: side }))}
      className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      Vendre
    </button>
  );
}
