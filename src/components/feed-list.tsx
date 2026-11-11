import Link from "next/link";
import { formatWholeCoinsFr } from "@/lib/format";
import { ago } from "@/lib/format-time";
import type { FeedEvent } from "@/server/feed";

/** "What friends just did": one line per event, linking to its market. */
export function FeedList({ events, now, meId }: { events: FeedEvent[]; now: number; meId: string }) {
  if (!events.length) return <p className="text-sm text-dim">Rien pour l&apos;instant. Le premier pari lancera le fil.</p>;
  return (
    <ul className="divide-y divide-line">
      {events.map((e, i) => (
        <li key={`${e.kind}-${e.marketId}-${e.at.getTime()}-${i}`}>
          <Link
            href={`/marches/${e.marketId}`}
            className="-mx-2 block rounded-lg px-2 py-3 transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {e.kind === "resolved" ? (
              <p className="text-sm">
                {e.memberId === meId ? "Ton marché" : <>Le marché de <span className="font-semibold">@{e.nickname}</span></>} est résolu :{" "}
                <span className={`font-semibold ${e.outcome === "YES" ? "text-yes" : "text-no"}`}>{e.outcome === "YES" ? "oui" : "non"}</span>
              </p>
            ) : (
              <p className="text-sm">
                <span className="font-semibold">{e.memberId === meId ? "Tu" : `@${e.nickname}`}</span>{" "}
                {e.kind === "market" ? (
                  e.memberId === meId ? "as lancé un marché" : "a lancé un marché"
                ) : (
                  <>
                    {e.memberId === meId ? "as" : "a"} {e.tradeKind === "buy" ? "parié" : "revendu"} {formatWholeCoinsFr(e.coins)}{" "}
                    {e.tradeKind === "buy" ? "sur" : "de"}{" "}
                    <span className={`font-semibold ${e.side === "YES" ? "text-yes" : "text-no"}`}>{e.side === "YES" ? "oui" : "non"}</span>
                  </>
                )}
              </p>
            )}
            <p className="mt-0.5 line-clamp-1 text-sm text-dim">{e.question}</p>
            <p className="mt-0.5 text-xs text-dim">{ago(e.at, now)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
