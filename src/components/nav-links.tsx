"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "Marchés" },
  { href: "/classement", label: "Classement" },
  { href: "/portefeuille", label: "Portefeuille" },
] as const;

const isActive = (path: string, href: string) => (href === "/" ? path === "/" || path.startsWith("/marches/") : path.startsWith(href));

/** Desktop navigation in the top bar. */
export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Navigation" className="hidden items-center gap-1 lg:flex">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={isActive(path, n.href) ? "page" : undefined}
          className="rounded-md px-3 py-1.5 text-sm font-semibold text-dim transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-secondary aria-[current=page]:text-ink"
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Phone navigation: a bottom tab bar with the "ask a question" action in the middle. */
export function MobileTabBar() {
  const path = usePathname();
  const tab = (href: string, label: string) => (
    <Link
      href={href}
      aria-current={isActive(path, href) ? "page" : undefined}
      className="flex h-12 items-center justify-center rounded-lg text-[13px] font-semibold text-dim focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:text-ink"
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-night/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4 items-center gap-1 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tab("/", "Marchés")}
        {tab("/classement", "Classement")}
        <Link
          href="/marches/nouveau"
          className="flex h-12 items-center justify-center rounded-xl bg-ink text-[13px] font-extrabold text-night focus-visible:ring-2 focus-visible:ring-yes focus-visible:outline-none"
        >
          + Question
        </Link>
        {tab("/portefeuille", "Portefeuille")}
      </div>
    </nav>
  );
}
