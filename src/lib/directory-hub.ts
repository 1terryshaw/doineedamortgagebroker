import { createServiceRoleClient } from "@/lib/supabase/server";
import { COUNTRY } from "@/lib/country";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/provinces";

export const REGION_PAGE_SIZE = 48;

export type DirectoryCity = {
  city: string;
  city_slug: string;
  count: number;
};

export type DirectoryRegion = {
  province: string; // 2-letter code (e.g. "ON")
  name: string;     // "Ontario"
  cities: DirectoryCity[];
};

export type DirectoryListing = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  province: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  photo_url: string | null;
  hero_image_url: string | null;
  is_premium: boolean | null;
  subscription_tier: string | null;
  mortgage_listing_specializations?: Array<{
    mortgage_specializations:
      | { slug: string; name: string; icon: string | null }
      | null;
  }> | null;
};

// Province code → full name (CA + US union, source-of-truth = provinces.ts)
const PROVINCE_NAME_MAP: Map<string, string> = new Map([
  ...CANADIAN_PROVINCES.map((p) => [p.code, p.name] as [string, string]),
  ...US_STATES.map((s) => [s.code, s.name] as [string, string]),
]);

function provinceName(code: string): string {
  return PROVINCE_NAME_MAP.get(code) ?? code;
}

/**
 * Derive directory regions DIRECTLY from mortgage_listings.
 * mv_mortgage_listings_cities is empty (keyed on the empty province_state col)
 * and mortgage_regions is sparse — neither is viable.
 */
export async function getDirectoryRegions(): Promise<DirectoryRegion[]> {
  const supabase = await createServiceRoleClient();

  // Page through with .range() in case of >1000 rows (Supabase default cap)
  const all: Array<{ province: string; city: string; city_slug: string }> = [];
  const pageSize = 1000;
  let from = 0;
  // hard cap at 50k rows to prevent runaway
  while (from < 50000) {
    const { data, error } = await supabase
      .from("mortgage_listings")
      .select("province, city, city_slug")
      .eq("country", COUNTRY)
      .eq("is_active", true)
      .not("province", "is", null)
      .not("city", "is", null)
      .not("city_slug", "is", null)
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as Array<{ province: string; city: string; city_slug: string }>));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const byProvince = new Map<string, Map<string, { city: string; count: number }>>();
  for (const row of all) {
    if (!byProvince.has(row.province)) byProvince.set(row.province, new Map());
    const cities = byProvince.get(row.province)!;
    const existing = cities.get(row.city_slug);
    if (existing) existing.count++;
    else cities.set(row.city_slug, { city: row.city, count: 1 });
  }

  const result: DirectoryRegion[] = [];
  for (const [province, cities] of Array.from(byProvince.entries())) {
    result.push({
      province,
      name: provinceName(province),
      cities: Array.from(cities.entries())
        .map(([city_slug, { city, count }]) => ({ city, city_slug, count }))
        .sort((a, b) => a.city.localeCompare(b.city)),
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export async function getListingsCount(): Promise<number> {
  const supabase = await createServiceRoleClient();
  const { count, error } = await supabase
    .from("mortgage_listings")
    .select("*", { count: "exact", head: true })
    .eq("country", COUNTRY)
    .eq("is_active", true);
  return error || !count ? 0 : count;
}

export type FilterOpts = {
  region?: string;   // province 2-letter code
  citySlug?: string;
  specSlug?: string; // mortgage_specializations.slug
  query?: string;    // name ilike
  page?: number;     // 1-indexed
  perPage?: number;  // default REGION_PAGE_SIZE
};

/**
 * Look-ahead pagination per pagination.md canon: fetch perPage+1 rows via
 * .range(from, from+perPage) (inclusive), slice off the last if present,
 * derive hasMore from data.length > perPage. No count query needed.
 */
export async function getFilteredListingsPaged(opts: FilterOpts = {}): Promise<{
  listings: DirectoryListing[];
  hasMore: boolean;
}> {
  const supabase = await createServiceRoleClient();
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? REGION_PAGE_SIZE;
  const from = (page - 1) * perPage;
  const to = from + perPage; // inclusive → fetches perPage+1 rows

  // Specialization filter via two-step lookup. Embedded !inner filter would
  // duplicate rows when a listing has multiple specs, breaking pagination math.
  let specFilterIds: string[] | null = null;
  if (opts.specSlug) {
    const { data: spec } = await supabase
      .from("mortgage_specializations")
      .select("id")
      .eq("slug", opts.specSlug)
      .limit(1)
      .maybeSingle();
    if (!spec) return { listings: [], hasMore: false };
    const { data: joinRows } = await supabase
      .from("mortgage_listing_specializations")
      .select("listing_id")
      .eq("specialization_id", spec.id);
    specFilterIds = (joinRows ?? []).map((r) => r.listing_id as string);
    if (specFilterIds.length === 0) return { listings: [], hasMore: false };
  }

  let q = supabase
    .from("mortgage_listings")
    .select(
      `id, slug, name, city, province,
       google_rating, google_review_count,
       photo_url, hero_image_url,
       is_premium, subscription_tier,
       mortgage_listing_specializations(
         mortgage_specializations(slug, name, icon)
       )`
    )
    .eq("country", COUNTRY)
    .eq("is_active", true);

  if (opts.region) q = q.eq("province", opts.region);
  if (opts.citySlug) q = q.eq("city_slug", opts.citySlug);
  if (opts.query) q = q.ilike("name", `%${opts.query}%`);
  if (specFilterIds) q = q.in("id", specFilterIds);

  q = q
    .order("google_rating", { ascending: false, nullsFirst: false })
    .order("google_review_count", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .range(from, to);

  const { data, error } = await q;
  if (error || !data) return { listings: [], hasMore: false };

  const hasMore = data.length > perPage;
  const listings = (hasMore ? data.slice(0, perPage) : data) as unknown as DirectoryListing[];
  return { listings, hasMore };
}
