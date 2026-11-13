import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/db";
import { isMarketId } from "@/lib/invite-cookie";
import { formatParis } from "@/lib/paris-time";
import { currentUserId } from "@/server/session";
import { getSharePreview, oddsLine, type SharePreview } from "@/server/share";

/**
 * A shared market link: /m/<id>?invite=CODE (decision 015). Members are sent
 * to the real market page; anyone else sees the question and the odds (only
 * for markets that name nobody) and a button that doubles as an invitation.
 */

const INVITE = /^[A-Z0-9]{4,32}$/i;

async function previewFor(id: string): Promise<SharePreview | null> {
  return isMarketId(id) ? getSharePreview(db, id) : null;
}

export async function generateMetadata({ params }: PageProps<"/m/[id]">): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const h = await headers();
  const base = new URL(`${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`);
  const p = await previewFor(id);
  const title = p ? p.question : "Un pari t'attend sur Poly'sen";
  const description = p ? `${oddsLine(p)}. Rejoins le groupe pour parier (pièces pour de faux).` : "Le marché de prédiction entre potes.";
  return {
    metadataBase: base,
    title,
    description,
    openGraph: { title, description, siteName: "Poly'sen", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    // Shared in group chats, never listed by search engines.
    robots: { index: false, follow: false },
  };
}

async function ShareContent({ params, searchParams }: Pick<PageProps<"/m/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  if (isMarketId(id) && (await currentUserId())) redirect(`/marches/${id}`);
  const p = await previewFor(id);
  const invite = (await searchParams).invite;
  const code = typeof invite === "string" && INVITE.test(invite) ? invite.toUpperCase() : null;
  const market = isMarketId(id) ? `?marche=${id}` : "";
  const signIn = isMarketId(id) ? `/connexion?suivant=${encodeURIComponent(`/marches/${id}`)}` : "/connexion";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-10">
      <p className="text-sm font-bold tracking-widest text-gold uppercase">Poly&apos;sen</p>
      {p ? (
        <section className="rounded-2xl border border-line bg-panel p-6">
          <h1 className="text-2xl leading-tight font-bold text-balance">{p.question}</h1>
          {p.status === "open" ? (
            <>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-yes tabular-nums">{p.percent} %</span>
                <span className="text-dim">oui, selon le groupe</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-no/60" aria-hidden>
                <div className="h-full bg-yes" style={{ width: `${p.percent}%` }} />
              </div>
              <p className="mt-3 text-sm text-dim">Fermeture des paris le {formatParis(p.closeAt)}.</p>
            </>
          ) : (
            <p className={`mt-5 text-3xl font-extrabold ${p.outcome === "NO" ? "text-no" : "text-yes"}`}>{oddsLine(p)}</p>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-line bg-panel p-6">
          <h1 className="text-2xl font-bold">Un pari t&apos;attend</h1>
          <p className="mt-2 text-dim">Ce marché n&apos;est visible que par les membres du groupe.</p>
        </section>
      )}

      <p className="text-dim">
        Poly&apos;sen, c&apos;est le marché de prédiction entre potes : on parie des pièces pour de faux sur ce qui arrive au groupe.
      </p>
      {code ? (
        <Link
          href={`/invitation/${code}${market}`}
          className="rounded-xl bg-gold px-5 py-3 text-center font-bold text-night"
          prefetch={false}
        >
          Rejoindre et parier
        </Link>
      ) : (
        <p className="text-sm text-dim">Pour jouer, demande un lien d&apos;invitation à un membre.</p>
      )}
      <Link href={signIn} className="text-center text-sm underline underline-offset-4">
        Déjà membre ? Se connecter
      </Link>
      <Link href="/confidentialite" className="text-center text-xs text-dim underline underline-offset-4">
        Confidentialité
      </Link>
    </div>
  );
}

export default function SharePage({ params, searchParams }: PageProps<"/m/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-72 w-full max-w-md animate-pulse rounded-2xl bg-panel" />}>
      <ShareContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
