const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A well-formed id, checked before it reaches a query or a redirect. */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}
