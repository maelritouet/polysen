import Link from "next/link";
import type { Row } from "@/server/leaderboard";
import { Gain } from "./portfolio";

const MEDAL = ["text-[#f5c451]", "text-[#c9d3df]", "text-[#d99a6c]"];

function RankCell({ rank }: { rank: number }) {
  return <span className={`w-7 shrink-0 text-right font-extrabold tabular-nums ${MEDAL[rank - 1] ?? "text-dim"}`}>{rank}</span>;
}

function Line({ row, me }: { row: Row; me: boolean }) {
  return (
    <li
      aria-current={me ? "true" : undefined}
      className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${me ? "bg-panel ring-1 ring-line" : ""}`}
    >
      <RankCell rank={row.rank} />
      <span className="min-w-0 flex-1 truncate font-semibold">
        @{row.nickname}
        {me && <span className="ml-1.5 font-normal text-dim">(toi)</span>}
      </span>
      <Gain amount={row.profit} className="font-semibold" />
    </li>
  );
}

/** The whole board, your row highlighted. */
export function LeaderboardList({ rows, meId }: { rows: Row[]; meId: string }) {
  return (
    <ol className="flex flex-col gap-0.5">
      {rows.map((r) => (
        <Line key={r.memberId} row={r} me={r.memberId === meId} />
      ))}
    </ol>
  );
}

/** Dashboard preview: the top 5, plus your own row if you are further down. */
export function LeaderboardPreview({ rows, meId }: { rows: Row[]; meId: string }) {
  const top = rows.slice(0, 5);
  const mine = rows.find((r) => r.memberId === meId);
  const below = mine && !top.includes(mine);
  return (
    <div>
      <ol className="flex flex-col gap-0.5">
        {top.map((r) => (
          <Line key={r.memberId} row={r} me={r.memberId === meId} />
        ))}
      </ol>
      {below && (
        <>
          <p aria-hidden className="py-0.5 pl-9 text-dim">
            ⋯
          </p>
          <ol>
            <Line row={mine} me />
          </ol>
        </>
      )}
      <Link href="/classement" className="mt-2 inline-block text-sm font-semibold text-dim hover:text-ink">
        Tout le classement →
      </Link>
    </div>
  );
}
