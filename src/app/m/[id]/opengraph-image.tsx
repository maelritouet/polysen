import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { db } from "@/db";
import { isMarketId } from "@/lib/invite-cookie";
import { getSharePreview } from "@/server/share";

/** The card WhatsApp, Instagram and Discord show for a shared market (decision 015). */

export const alt = "Un marché sur Poly'sen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colours from globals.css (the night trading floor, decision 010).
const C = { night: "#0f1b2d", panel: "#16263d", line: "#24384f", ink: "#e8eef6", dim: "#8da0b8", yes: "#3be0a0", no: "#ff6b6b", gold: "#f5c451" };

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const p = isMarketId(id) ? await getSharePreview(db, id) : null;
  const question = p?.question ?? "Un pari t'attend sur Poly'sen";
  const resolved = p?.status === "resolved";
  const big = !p ? "?" : resolved ? (p.outcome === "NO" ? "NON" : "OUI") : `${p.percent} %`;
  const bigColour = !p ? C.gold : resolved && p.outcome === "NO" ? C.no : C.yes;
  const caption = !p ? "Réservé aux membres du groupe" : resolved ? "Résultat" : "de chances selon le groupe";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.night, color: C.ink, padding: 64 }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 6, color: C.gold }}>POLY&apos;SEN</div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: question.length > 90 ? 52 : 64, fontWeight: 700, lineHeight: 1.15 }}>
          {question}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontSize: 120, fontWeight: 800, color: bigColour, lineHeight: 1 }}>{big}</span>
            <span style={{ fontSize: 34, color: C.dim }}>{caption}</span>
          </div>
          <span style={{ fontSize: 28, color: C.dim }}>Pièces pour de faux</span>
        </div>
        {p && !resolved && (
          <div style={{ display: "flex", marginTop: 32, height: 16, borderRadius: 8, background: C.no, overflow: "hidden" }}>
            <div style={{ width: `${p.percent}%`, background: C.yes }} />
          </div>
        )}
      </div>
    ),
    size,
  );
}
