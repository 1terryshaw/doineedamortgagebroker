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
  province: string;
  name: string;
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

const PROVINCE_NAME_MAP: Map<string, string> = new Map([
  ...CANADIAN_PROVINCES.map((p) => [p.code, p.name] as [string, string]),
  ...US_STATES.map((s) => [s.code, s.name] as [string, string]),
]);

function provinceName(code: string): string {
  return PROVINCE_NAME_MAP.get(code) ?? code;
}

/**
 * Derive directory regions directly from mortgage_listings.
 * mv_mortgage_listings_cities is empty and mortgage_regions is sparse.
 *
 * 2c fix: added .order() before .range() — Postgres OFFSET pagination is
 * undefined without ORDER BY. Pre-fix, the separate paginated queries returned
 * an inconsistent row set (no stable sort across calls), so ~7% of city slugs
 * were intermittently dropped from the dropdowns.
 */
export async function getDirectoryRegions(): Promise<DirectoryRegion[]> {
  const supabase = await createServiceRoleClient();

  type Row = { province: string; city: string; city_slug: string };
  const all: Row[] = [];
  const pageSize = 1000;
  let from = 0;
  while (from < 50000) {
    const { data, error } = await supabase
      .from("mortgage_listings")
      .select("province, city, city_slug")
      .eq("country", COUNTRY)
      .eq("is_active", true)
      .not("province", "is", null)
      .not("city", "is", null)
      .not("city_slug", "is", null)
      .order("province", { ascending: true })
      .order("city_slug", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as Row[]));
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

export type SpecializationOption = {
  slug: string;
  name: string;
  icon: string | null;
};

export async function getSpecializations(): Promise<SpecializationOption[]> {
  const supabase = await createServiceRoleClient();
  const { data } = await supabase
    .from("mortgage_specializations")
    .select("slug, name, icon")
    .order("sort_order", { ascending: true });
  return (data as SpecializationOption[] | null) ?? [];
}

/**
 * Whether any listing IN THIS COUNTRY is tagged with a specialization.
 * mortgage_listing_specializations is currently empty empire-wide, so the
 * specialization tiles/filters are dead UI — gate them on this so they
 * auto-reappear once the join table is populated for the country.
 */
export async function specializationsEnabled(): Promise<boolean> {
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from("mortgage_listing_specializations")
    .select("listing_id, mortgage_listings!inner(country)")
    .eq("mortgage_listings.country", COUNTRY)
    .limit(1);
  return !error && !!data && data.length > 0;
}

export type FilterOpts = {
  region?: string;
  citySlug?: string;
  specSlug?: string;
  query?: string;
  page?: number;
  perPage?: number;
};

export async function getFilteredListingsPaged(opts: FilterOpts = {}): Promise<{
  listings: DirectoryListing[];
  hasMore: boolean;
}> {
  const supabase = await createServiceRoleClient();
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? REGION_PAGE_SIZE;
  const from = (page - 1) * perPage;
  const to = from + perPage;

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
