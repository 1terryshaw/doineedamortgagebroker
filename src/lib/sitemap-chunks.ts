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

/**
 * THE RULE (canon: ~/empire/knowledge/aeo-cohorts.md): lastmod tracks the RENDER,
 * not the DB row. A page's <lastmod> may only move when its SERVED HTML moved.
 *
 * `mortgage_listings.updated_at` is NOT a content timestamp and must never be cited
 * here. A live BEFORE UPDATE trigger (mortgage_listings_updated_at →
 * update_mortgage_updated_at) sets updated_at = NOW() on ANY write to the row —
 * including writes that change zero rendered bytes:
 *   - outreach drip stamps (outreach_email1..4_at) — mortgage is an active outreach
 *     vertical (scripts/empire-outreach.ts). Emailing a broker was bumping that
 *     broker's <lastmod> to "today". Measured: 40 CA listings/day, every weekday.
 *   - bulk maintenance writes — a single 2026-07-01 migration re-stamped 64,519/64,587
 *     US and 6,154/6,434 CA rows to that instant.
 * Net effect: ~100% of listing URLs were publishing a false "fresh today" lastmod
 * while their actual content dated to Mar–Jun. That teaches Google to discount our
 * lastmod wholesale. The trigger is load-bearing for other consumers and is NOT
 * touched — the lie is corrected here, at the point of publication.
 *
 * CONTENT_COLS: the only row timestamps that provably move the served HTML of
 * /listing/[slug] (verified against the fields the page actually renders):
 *   created_at            — the row's content first existed (name/address/phone/bio/
 *                           website/licence/languages/years_experience/photo/lat-lng)
 *   google_data_cached_at — cached_photos + rating/review counts are rendered
 *   owner_last_action_at  — owner edited their own listing
 *   claimed_at            — flips the claim CTA / badge render
 *   enrichment_at         — EnrichmentBlock renders enrichment
 * DELIBERATELY EXCLUDED (write the row, render nothing): updated_at, outreach_email*_at,
 * outreach_bounced/unsubscribed, email_harvested_at, email_invalid, last_verified_at,
 * verification_status. Per THE RULE, a write that renders nowhere is not a content
 * change and must not touch lastmod.
 */
const CONTENT_COLS = [
  "created_at",
  "google_data_cached_at",
  "owner_last_action_at",
  "claimed_at",
  "enrichment_at",
] as const;

const LISTING_CONTENT_SELECT = `slug, ${CONTENT_COLS.join(", ")}`;

type ContentRow = Partial<Record<(typeof CONTENT_COLS)[number], string | null>>;

/** GREATEST(content-bearing timestamps) for one row — the row's true content date. */
function contentLastmod(row: ContentRow, fallback: string): string {
  let best = 0;
  for (const col of CONTENT_COLS) {
    const raw = row[col];
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best > 0 ? new Date(best).toISOString() : fallback;
}

/**
 * The newest content date anywhere in the served corpus, used as the lastmod for
 * INDEX-shaped pages (home, /search, region hubs, region×spec) and the sitemapindex.
 *
 * Those pages previously stamped `new Date()` — a lastmod that varies on EVERY
 * REQUEST, i.e. 43,660 US URLs claiming "changed this instant" on every fetch. That
 * is a worse false-freshness defect than the listing one and is what this replaces.
 *
 * An index page over the corpus cannot be newer than the newest content in the
 * corpus, so this is a real content date and is stable across requests. Known
 * residual: it OVERSTATES a quiet region whose own newest listing is older than the
 * corpus max. The strictly-true value is per-region MAX(contentLastmod), which needs
 * a full 64k-row scan of mortgage_listings inside a force-dynamic route — this repo
 * has a live 50k PostgREST-truncation history (TDL #957 silently dropped 14,587
 * listings), so that scan is NOT being added in the same commit as the churn fix.
 * Filed as the follow-up; a per-region aggregate view is the right shape.
 *
 * Cost: 5 single-row ordered reads (LIMIT 1), no truncation surface.
 */
async function getCorpusContentMax(fallback: string): Promise<string> {
  const supabase = await createServiceRoleClient();
  const results = await Promise.all(
    CONTENT_COLS.map((col) =>
      supabase
        .from("mortgage_listings")
        .select(col)
        .eq("is_active", true)
        .eq("country", COUNTRY)
        .not(col, "is", null)
        .order(col, { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );
  let best = 0;
  for (let i = 0; i < results.length; i++) {
    const raw = (results[i].data as ContentRow | null)?.[CONTENT_COLS[i]];
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best > 0 ? new Date(best).toISOString() : fallback;
}

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
  // Was `new Date()` — a per-request-varying lastmod on every child sitemap.
  const lastmod = await getCorpusContentMax(new Date().toISOString());
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
  // Index-shaped pages (static/hubs/spec) cite the corpus's newest CONTENT date,
  // never `now` — see getCorpusContentMax. `now` survives only as a last-resort
  // fallback for a row with no content timestamp at all (none exist today).
  const indexLastmod = await getCorpusContentMax(now);
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
      for (const e of staticEntries(indexLastmod).slice(a, b)) out.push(renderUrl(e));
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
        out.push(renderUrl({ loc: `${SITE_URL}/${region.slug}`, lastmod: indexLastmod, changefreq: "weekly", priority: "0.8" }));
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
              lastmod: indexLastmod,
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
      // ORDER BY id + the same range() as before — partitioning and the URL set are
      // untouched. ONLY the lastmod value changes: updated_at (outreach/bulk-write
      // polluted) -> GREATEST(content-bearing cols). See THE RULE above.
      const { data } = await supabase
        .from("mortgage_listings")
        .select(LISTING_CONTENT_SELECT)
        .eq("is_active", true)
        .eq("country", COUNTRY)
        .order("id")
        .range(a, b - 1);
      for (const listing of ((data ?? []) as unknown) as (ContentRow & { slug: string })[])
        out.push(
          renderUrl({
            loc: `${SITE_URL}/listing/${listing.slug}`,
            lastmod: contentLastmod(listing, now),
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
