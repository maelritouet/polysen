import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Confidentialité · Poly'sen" };

/** The privacy note (PRD "Personal data"): a few lines, plain French, public. */
export default function ConfidentialitePage() {
  return (
    <article className="mx-auto flex max-w-xl flex-col gap-6 pt-8 leading-relaxed">
      <h1 className="text-3xl font-bold tracking-tight">Tes données sur Poly&apos;sen</h1>
      <p className="text-dim">
        Poly&apos;sen est un jeu entre potes, avec des pièces pour de faux. On garde le strict minimum, et rien n&apos;est vendu ni
        montré à des annonceurs.
      </p>

      <section>
        <h2 className="font-bold">Ce qu&apos;on garde</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-dim">
          <li>Ton e-mail (ou ton compte Google), seulement pour te connecter. Les autres membres ne le voient pas.</li>
          <li>Ton prénom et ton pseudo, affichés aux autres membres sur tes paris, tes marchés et tes commentaires.</li>
          <li>Ce que tu fais dans le jeu : paris, ventes, marchés, commentaires, signalements, qui t&apos;a invité.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold">Où et comment</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-dim">
          <li>Les données sont hébergées dans l&apos;Union européenne.</li>
          <li>Aucun traceur publicitaire, aucune mesure d&apos;audience. Les seuls cookies servent à te garder connecté et à retenir ton lien d&apos;invitation.</li>
          <li>Seuls les membres connectés voient le jeu. Un lien partagé montre au public la question et la cote d&apos;un marché, jamais un nom, et jamais un marché qui nomme quelqu&apos;un.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold">Les marchés sur une personne</h2>
        <p className="mt-2 text-dim">
          Un marché qui te nomme ne s&apos;ouvre qu&apos;avec ton accord. Tu peux le retirer à tout moment depuis la page du marché : il est
          annulé et tout le monde est remboursé.
        </p>
      </section>

      <section>
        <h2 className="font-bold">Supprimer ton compte</h2>
        <p className="mt-2 text-dim">
          Depuis ton portefeuille. Ton e-mail, ton prénom et ton pseudo sont effacés et tu ne peux plus te connecter. Tes anciens
          paris restent dans les totaux des marchés, sous un nom anonyme, pour que les comptes des autres restent justes.
        </p>
      </section>

      <p className="text-sm text-dim">
        Une question, ou envie de récupérer tes données ? Demande à l&apos;admin du groupe.
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Retour au jeu
      </Link>
    </article>
  );
}
