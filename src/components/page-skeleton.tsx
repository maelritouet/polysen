/** Placeholder shown instantly while a page's per-member data loads. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-36 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
