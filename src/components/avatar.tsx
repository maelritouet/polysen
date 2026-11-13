/**
 * A member's round photo, or their initials (served by /photo/<id>, decision 018).
 * A plain <img>: the Next image optimiser fetches without the viewer's cookies.
 */
export function Avatar({ memberId, size = 24, version, className = "" }: { memberId: string; size?: number; version?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/photo/${memberId}${version ? `?v=${version}` : ""}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 rounded-full bg-panel object-cover ${className}`}
    />
  );
}
