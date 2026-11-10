export function FormMessage({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (ok) return <p role="status" className="text-sm text-muted-foreground">{ok}</p>;
  return null;
}
