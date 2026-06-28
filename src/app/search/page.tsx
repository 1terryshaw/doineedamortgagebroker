import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// /search is retired in favour of /directory (the canonical search surface).
// Forward only the free-text name query `q`; the legacy `city`/`specialization`
// params were mortgage_regions slugs that don't map to the listing-derived
// /directory filters, so they are intentionally dropped.
type SP = { q?: string };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  const qs = params.toString();
  redirect(`/directory${qs ? `?${qs}` : ""}`);
}
