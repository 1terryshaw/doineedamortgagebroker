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
        // De-serve read guard — see the note on getSegments(). Identical predicate.
        .neq("is_published", false)
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

/**
 * Spec slugs that have at least one listing link behind them, ordered by slug.
 *
 * TDL #1241. `mortgage_listing_specializations` is currently EMPTY, so every
 * /{region}/{spec} hub renders zero listings; that route now calls notFound() rather
 * than serving a thin HTTP 200 (Site Surfer 2026-09-16 EMPTY-HUB-200). The sitemap has
 * to agree with the route, so the region x spec segment is derived from the specs the
 * hubs can actually render, not from the static 9-row mortgage_specializations table.
 * Today this returns [] -> P = 0 -> RS = 0 -> no spec URLs are emitted at all.
 *
 * RESIDUAL GAP (documented, not fixed here): occupancy is GLOBAL, not per region. Once
 * spec links exist, RS is still R x P, so a (region, spec) pair with no listings in
 * THAT region would be advertised and would 404. Closing that needs the segment to
 * enumerate real pairs, which breaks the offset-range sharding this file depends on
 * (RS = R * P). Revisit when spec links are first loaded.
 *
 * The link table is read in full to distinct its specialization_ids; it holds 0 rows
 * today and is expected to stay small relative to the listing corpus.
 */
export async function getOccupiedSpecSlugs(): Promise<string[]> {
  const supabase = await createServiceRoleClient();
  const { data: links } = await supabase
    .from("mortgage_listing_specializations")
    .select("specialization_id");
  const ids = Array.from(
    new Set(((links ?? []) as { specialization_id: string }[]).map((l) => l.specialization_id)),
  );
  if (ids.length === 0) return [];
  const { data: specs } = await supabase
    .from("mortgage_specializations")
    .select("slug")
    .in("id", ids)
    .order("slug");
  return ((specs ?? []) as { slug: string }[]).map((sp) => sp.slug);
}

/**
 * The region slugs that a REGION HUB actually exists for — i.e. regions with at
 * least one listing that passes the SAME predicate `/[citySlug]` renders from
 * (is_active, country, and the de-serve read guard).
 *
 * TDL #1257. Routes and the sitemap are two expressions of ONE gate, and #1241
 * applied that rule to the SPEC segment only. The hub segment kept counting every
 * row of `mortgage_regions`, so the moment `/[citySlug]` gates on occupancy the
 * sitemap would advertise the hubs that start 404ing. Measured on prod before the
 * flip: findmymortgagebroker.ca advertised 61 one-segment hubs, of which 13 —
 * /bradford-west-gwillimbury, /chatham-kent, /east-gwillimbury, /georgina,
 * /halton-hills, /huntsville, /innisfil, /kawartha-lakes, /midland,
 * /new-tecumseth, /norfolk-county, /quinte-west, /wasaga-beach — served HTTP 200
 * with ZERO listing links. This derivation is what keeps that intersection at 0.
 *
 * `region_id` is scanned in pages because PostgREST caps a response at 1000 rows;
 * a single unranged select would silently truncate and under-report occupancy,
 * which fails in the DANGEROUS direction (a live hub dropped from the sitemap).
 */
export async function getOccupiedRegionSlugs(): Promise<string[]> {
  const supabase = await createServiceRoleClient();
  const occupied = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("mortgage_listings")
      .select("region_id")
      .eq("is_active", true)
      .eq("country", COUNTRY)
      .neq("is_published", false)
      .not("region_id", "is", null)
      .order("region_id")
      .range(from, from + PAGE - 1);
    // FAIL CLOSED on a paging error: returning a SHORT set here would drop live
    // hubs out of the sitemap, which is worse than emitting none.
    if (error) throw new Error(`getOccupiedRegionSlugs failed at offset ${from}: ${error.message}`);
    const rows = (data ?? []) as { region_id: string }[];
    for (const r of rows) if (r.region_id) occupied.add(r.region_id);
    if (rows.length < PAGE) break;
  }
  if (occupied.size === 0) return [];
  // Resolve ids -> slugs inside the province whitelist, ordered by slug, in
  // chunks because `.in()` takes a URL-encoded list.
  const ids = Array.from(occupied);
  const slugs: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("mortgage_regions")
      .select("slug")
      .in("id", ids.slice(i, i + 200))
      .in("province", PROVINCE_WHITELIST[COUNTRY]);
    if (error) throw new Error(`getOccupiedRegionSlugs slug resolve failed: ${error.message}`);
    for (const r of (data ?? []) as { slug: string }[]) slugs.push(r.slug);
  }
  return slugs.sort();
}

/** Count each segment (head-only count queries) and derive the chunk count. */
export async function getSegments(): Promise<Segments> {
  const supabase = await createServiceRoleClient();
  const [occupiedRegions, occupiedSpecs, lRes] = await Promise.all([
    // OCCUPIED regions only (TDL #1257) — a region with no listing behind it
    // renders a hub that now 404s, so counting every mortgage_regions row here
    // would advertise dead URLs. Same rule the spec segment already follows.
    getOccupiedRegionSlugs(),
    // OCCUPIED specs only — see getOccupiedSpecSlugs(). A spec with no listing links
    // behind it produces /{region}/{spec} hubs that render zero listings, and those
    // hubs now 404 (TDL #1241 empty-hub gate). Routes and the sitemap are two
    // expressions of ONE gate: counting all 9 specs here while the route 404s them
    // would advertise R x 9 dead URLs.
    getOccupiedSpecSlugs(),
    supabase
      .from("mortgage_listings")
      .select("slug", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("country", COUNTRY)
      // DE-SERVE READ GUARD — the sitemap must not advertise a withdrawn URL (recon-v1
      // §A4: 548/548 de-served slugs were present across the three shards).
      //
      // ⚠ THE PREDICATE MUST BE IDENTICAL IN ALL THREE LISTING READS IN THIS FILE
      // (this count, getCorpusContentMax, and renderChunk's range read). Sharding is
      // deterministic offset-ranging over a COUNT taken here and a range() taken there —
      // if the two disagree by even one row the partition slips and shards silently drop
      // or duplicate URLs. Change one, change all three.
      .neq("is_published", false),
  ]);
  const S = staticEntries("").length;
  const R = occupiedRegions.length;
  const P = occupiedSpecs.length;
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
      // The SAME derivation getSegments() counted R from — see getOccupiedRegionSlugs().
      const hubSlugs = (await getOccupiedRegionSlugs()).slice(a, b);
      for (const slug of hubSlugs)
        out.push(renderUrl({ loc: `${SITE_URL}/${slug}`, lastmod: indexLastmod, changefreq: "weekly", priority: "0.8" }));
    }

    // --- REGION × SPEC (region-major, spec-minor; region.slug then spec.slug) ---
    if (P > 0 && lo < specEnd && hi > specStart) {
      const a = Math.max(lo, specStart) - specStart; // local index in [0, RS)
      const b = Math.min(hi, specEnd) - specStart;
      const rStart = Math.floor(a / P);
      const rEnd = Math.floor((b - 1) / P); // inclusive region index
      const [specSlugs, allRegionSlugs] = await Promise.all([
        // The SAME derivation getSegments() counted P from — see getOccupiedSpecSlugs().
        getOccupiedSpecSlugs(),
        // ...and the SAME one it counted R from — see getOccupiedRegionSlugs().
        getOccupiedRegionSlugs(),
      ]);
      const specArr = specSlugs;
      const regionArr = allRegionSlugs.slice(rStart, rEnd + 1).map((slug) => ({ slug }));
      // Fail CLOSED on a count/list disagreement: the shard bounds were computed from
      // getSegments()'s P, and indexing into a different-length list slips the
      // partition (URLs silently dropped or duplicated across shards). Emit NO spec
      // URLs in that case; the static/hub/listing segments this chunk already holds
      // are unaffected and still ship.
      if (specArr.length === P) {
      for (let ri = 0; ri < regionArr.length; ri++) {
          const globalRegionIdx = rStart + ri;
          for (let pi = 0; pi < specArr.length; pi++) {
            const localIdx = globalRegionIdx * P + pi;
            if (localIdx < a || localIdx >= b) continue;
            out.push(
              renderUrl({
                loc: `${SITE_URL}/${regionArr[ri].slug}/${specArr[pi]}`,
                lastmod: indexLastmod,
                changefreq: "weekly",
                priority: "0.7",
              }),
            );
          }
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
        // De-serve read guard — IDENTICAL to getSegments()'s count. See the warning there.
        .neq("is_published", false)
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
