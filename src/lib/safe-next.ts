/** Only same-site paths, so a crafted link can't bounce people to another site. */
export function safeNext(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}
