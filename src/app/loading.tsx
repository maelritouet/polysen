import { PageSkeleton } from "@/components/page-skeleton";

/**
 * Shown instantly while a page's per-member data loads. Every page here is
 * personal (balance, profile...), so Next.js prerenders this placeholder and
 * streams the real page in (Cache Components, see Next.js "building" guide).
 */
export default function Loading() {
  return <PageSkeleton />;
}
