import { createServiceRoleClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/constants";
import { COUNTRY, PROVINCE_WHITELIST } from "@/lib/country";

/**
 * Chunked-sitemap engine (TDL #957). The apex universe (~93k URLs) exceeds the
 * sitemap.org 50,000-URL / 50MB per-file ceiling, so /sitemap.xml is a
 * <sitemapindex> and the URLs are sharded into /sitemap/{i}.xml children of
 * CHUNK_SIZE each.
 *
 * Sharding is DETERMINISTIC offset-ranging over a stable ORDER BY (regions by
 * slug, listings by id) — same DB state in => same partition out. lastmod is
 * preserved per row (listings carry updated_at). Every URL type is folded into
 * ONE globally-ordered stream and sliced by global offset, so NO child sitemap
 * can exceed CHUNK_SIZE regardless of how the region/spec/listing mix grows
 * (i.e. the "static + hubs in chunk 0" shortcut is intentionally avoided — it
 * silently overflows once the non-listing set passes the ceiling).
 *
 * Global stream order:
 *   [ STATIC(2) ] [ REGION_HUBS(R) ] [ REGION×SPEC(R*P) ] [ LISTINGS(L) ]
 */

export const CHUNK_SIZE = 45_000; // headroom under the 50k protocol ceiling

interface UrlEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderUrl(e: UrlEntry): string {
  return `  <url><loc>${xmlEscape(e.loc)}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`;
}

function staticEntries(now: string): UrlEntry[] {
  return [
    { loc: SITE_URL, lastmod: now, changefreq: "daily", priority: "1.0" },
    { loc: `${SITE_URL}/search`, lastmod: now, changefreq: "daily", priority: "0.9" },
  ];
}

export interface Segments {
  S: number; // static
  R: number; // region hubs
  P: number; // specializations
  RS: number; // region × spec
  L: number; // listings
  T: number; // total
  totalChunks: number;
}

/** Count each segment (head-only count queries) and derive the chunk count. */
export async function getSegments(): Promise<Segments> {
  const supabase = await createServiceRoleClient();
  const [rRes, pRes, lRes] = await Promise.all([
    supabase
      .from("mortgage_regions")
      .select("slug", { count: "exact", head: true })
      .in("province", PROVINCE_WHITELIST[COUNTRY]),
    supabase
      .from("mortgage_specializations")
      .select("slug", { count: "exact", head: true }),
    supabase
      .from("mortgage_listings")
      .select("slug", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("country", COUNTRY),
  ]);
  const S = staticEntries("").length;
  const R = rRes.count ?? 0;
  const P = pRes.count ?? 0;
  const RS = R * P;
  const L = lRes.count ?? 0;
  const T = S + R + RS + L;
  const totalChunks = Math.max(1, Math.ceil(T / CHUNK_SIZE));
  return { S, R, P, RS, L, T, totalChunks };
}

/** The <sitemapindex> body: one <sitemap> per child chunk. */
export async function renderIndex(baseUrl: string): Promise<string> {
  const { totalChunks } = await getSegments();
  const lastmod = new Date().toISOString();
  const rows = Array.from(
    { length: totalChunks },
    (_, i) =>
      `  <sitemap><loc>${baseUrl}/sitemap/${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows}
</sitemapindex>`;
}

/** The <urlset> body for child chunk `id` (0-based). Empty if out of range. */
export async function renderChunk(id: number): Promise<string> {
  const seg = await getSegments();
  const { S, R, P, RS, L, T } = seg;
  const lo = id * CHUNK_SIZE;
  const hi = Math.min(lo + CHUNK_SIZE, T);
  const now = new Date().toISOString();
  const out: string[] = [];

  if (id >= 0 && lo < T) {
    const supabase = await createServiceRoleClient();

    // segment [start, end) global bounds
    const staticEnd = S;
    const hubStart = S,
      hubEnd = S + R;
    const specStart = S + R,
      specEnd = S + R + RS;
    const listStart = S + R + RS,
      listEnd = T; // eslint-disable-line @typescript-eslint/no-unused-vars

    // --- STATIC ---
    if (lo < staticEnd) {
      const a = Math.max(lo, 0);
      const b = Math.min(hi, staticEnd);
      for (const e of staticEntries(now).slice(a, b)) out.push(renderUrl(e));
    }

    // --- REGION HUBS (ordered by slug) ---
    if (lo < hubEnd && hi > hubStart) {
      const a = Math.max(lo, hubStart) - hubStart;
      const b = Math.min(hi, hubEnd) - hubStart;
      const { data } = await supabase
        .from("mortgage_regions")
        .select("slug")
        .in("province", PROVINCE_WHITELIST[COUNTRY])
        .order("slug")
        .range(a, b - 1);
      for (const region of data ?? [])
        out.push(renderUrl({ loc: `${SITE_URL}/${region.slug}`, lastmod: now, changefreq: "weekly", priority: "0.8" }));
    }

    // --- REGION × SPEC (region-major, spec-minor; region.slug then spec.slug) ---
    if (P > 0 && lo < specEnd && hi > specStart) {
      const a = Math.max(lo, specStart) - specStart; // local index in [0, RS)
      const b = Math.min(hi, specEnd) - specStart;
      const rStart = Math.floor(a / P);
      const rEnd = Math.floor((b - 1) / P); // inclusive region index
      const [{ data: specs }, { data: regions }] = await Promise.all([
        supabase.from("mortgage_specializations").select("slug").order("slug"),
        supabase
          .from("mortgage_regions")
          .select("slug")
          .in("province", PROVINCE_WHITELIST[COUNTRY])
          .order("slug")
          .range(rStart, rEnd),
      ]);
      const specArr = specs ?? [];
      const regionArr = regions ?? [];
      for (let ri = 0; ri < regionArr.length; ri++) {
        const globalRegionIdx = rStart + ri;
        for (let pi = 0; pi < specArr.length; pi++) {
          const localIdx = globalRegionIdx * P + pi;
          if (localIdx < a || localIdx >= b) continue;
          out.push(
            renderUrl({
              loc: `${SITE_URL}/${regionArr[ri].slug}/${specArr[pi].slug}`,
              lastmod: now,
              changefreq: "weekly",
              priority: "0.7",
            }),
          );
        }
      }
    }

    // --- LISTINGS (ordered by id) ---
    if (lo < listEnd && hi > listStart) {
      const a = Math.max(lo, listStart) - listStart;
      const b = Math.min(hi, listEnd) - listStart;
      const { data } = await supabase
        .from("mortgage_listings")
        .select("slug, updated_at")
        .eq("is_active", true)
        .eq("country", COUNTRY)
        .order("id")
        .range(a, b - 1);
      for (const listing of data ?? [])
        out.push(
          renderUrl({
            loc: `${SITE_URL}/listing/${listing.slug}`,
            lastmod: listing.updated_at ?? now,
            changefreq: "weekly",
            priority: "0.6",
          }),
        );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${out.join("\n")}
</urlset>`;
}
