/**
 * Shown instantly while a page's per-member data loads. Every page here is
 * personal (balance, profile...), so Next.js prerenders this placeholder and
 * streams the real page in (Cache Components, see Next.js "building" guide).
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-36 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
