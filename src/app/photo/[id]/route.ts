import { db } from "@/db";
import { isUuid } from "@/lib/uuid";
import { currentUserId } from "@/server/session";
import { getPhoto, initialsSvg } from "@/server/photos";

/**
 * A member's photo, or their initials when they have none (decision 018).
 * Members only: photos never leave the group. Cached a few minutes in the
 * viewer's browser, never by a shared cache.
 */
export async function GET(_request: Request, ctx: RouteContext<"/photo/[id]">) {
  if (!(await currentUserId())) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  const photo = isUuid(id) ? await getPhoto(db, id) : null;
  const headers = {
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
  };
  if (photo?.kind === "photo") {
    return new Response(new Uint8Array(photo.image), { headers: { ...headers, "Content-Type": "image/webp" } });
  }
  return new Response(initialsSvg(photo?.nickname ?? "?"), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
