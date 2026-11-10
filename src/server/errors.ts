/**
 * A refusal the member should see, with a message in French
 * ("not enough coins", "already claimed today"...). Anything else that is
 * thrown is a bug and shows a generic error.
 */
export class UserError extends Error {
  readonly isUserError = true;
}

export function isUserError(err: unknown): err is UserError {
  return err instanceof Error && (err as Partial<UserError>).isUserError === true;
}

/** Postgres error code for a unique-constraint violation, with the constraint's name. */
export function uniqueViolation(err: unknown): string | null {
  const e = (err as { cause?: { code?: string; constraint_name?: string } })?.cause ?? (err as { code?: string; constraint_name?: string });
  return e?.code === "23505" ? (e.constraint_name ?? "") : null;
}
