import { createServiceRoleClient } from "@/lib/supabase/server";
import { COUNTRY } from "@/lib/country";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/provinces";
import { isStatementTimeout, withTimeoutRetry } from "@/lib/db-timeout";

export const REGION_PAGE_SIZE = 48;

/** Cap deep OFFSET pages — page N with OFFSET (N-1)*48 still scans; refuse past this. */
export const MAX_DIRECTORY_PAGE = 50;

/** Keyset page size for facet / sitemap-style walks — never a 50k deep OFFSET. */
export const KEYSET_PAGE = 1_000;

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

/** Static province shells (empty cities) — soft-shell fallback when the DB faults. */
export function fallbackDirectoryRegions(): DirectoryRegion[] {
  const list = COUNTRY === "CA" ? CANADIAN_PROVINCES : US_STATES;
  return list.map((r) => ({
    province: r.code,
    name: r.name,
    cities: [],
  }));
}

let _regionsCache: { ts: number; data: DirectoryRegion[] } | null = null;
const REGIONS_TTL_MS = 60 * 60 * 1000; // 1h — region facets change slowly

/**
 * Derive directory regions from mortgage_listings via id KEYSET pages.
 *
 * Previously used deep `.range(from, from+999)` OFFSET walks up to 50k rows — under
 * PostgREST contention that blew the ~8s authenticator statement_timeout (57014) and
 * held the force-dynamic homepage + /directory at ~8–10s TTFB.
 *
 * Throws on query error (incl. 57014) so callers can soft-shell. Module TTL cache
 * keeps warm instances off the live table for an hour.
 */
export async function getDirectoryRegions(): Promise<DirectoryRegion[]> {
  if (_regionsCache && Date.now() - _regionsCache.ts < REGIONS_TTL_MS) {
    return _regionsCache.data;
  }

  const data = await withTimeoutRetry("getDirectoryRegions", fetchDirectoryRegionsKeyset);
  _regionsCache = { ts: Date.now(), data };
  return data;
}

async function fetchDirectoryRegionsKeyset(): Promise<DirectoryRegion[]> {
  const supabase = await createServiceRoleClient();

  type Row = { id: string; province: string; city: string; city_slug: string };
  const all: Row[] = [];
  let lastId: string | null = null;

  for (;;) {
    let q = supabase
      .from("mortgage_listings")
      .select("id, province, city, city_slug")
      .eq("country", COUNTRY)
      .eq("is_active", true)
      .neq("is_published", false)
      .not("province", "is", null)
      .not("city", "is", null)
      .not("city_slug", "is", null)
      .order("id", { ascending: true })
      .limit(KEYSET_PAGE);
    if (lastId) q = q.gt("id", lastId);

    const { data, error } = await q;
    if (error) {
      const err = Object.assign(new Error(error.message), {
        code: (error as { code?: string }).code ?? (isStatementTimeout(error) ? "57014" : undefined),
      });
      throw err;
    }
    const page = (data ?? []) as Row[];
    if (page.length === 0) break;
    for (const row of page) {
      lastId = row.id;
      all.push(row);
    }
    if (page.length < KEYSET_PAGE) break;
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
  return withTimeoutRetry("getListingsCount", async () => {
    const supabase = await createServiceRoleClient();
    const { count, error } = await supabase
      .from("mortgage_listings")
      .select("*", { count: "exact", head: true })
      .eq("country", COUNTRY)
      .eq("is_active", true)
      .neq("is_published", false);
    if (error) {
      throw Object.assign(new Error(error.message), {
        code: (error as { code?: string }).code,
      });
    }
    return count ?? 0;
  });
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
  try {
    return await withTimeoutRetry("specializationsEnabled", async () => {
      const supabase = await createServiceRoleClient();
      const { data, error } = await supabase
        .from("mortgage_listing_specializations")
        .select("listing_id, mortgage_listings!inner(country)")
        .eq("mortgage_listings.country", COUNTRY)
        .limit(1);
      if (error) {
        throw Object.assign(new Error(error.message), {
          code: (error as { code?: string }).code,
        });
      }
      return !!data && data.length > 0;
    });
  } catch (err) {
    // Soft: specialization tiles are optional; a timeout must not blank the homepage.
    console.warn("[directory-hub] specializationsEnabled degraded to false:", err);
    return false;
  }
}

export type FilterOpts = {
  region?: string;
  citySlug?: string;
  specSlug?: string;
  query?: string;
  page?: number;
  perPage?: number;
};

/**
 * Paged directory listings. Page size stays small (REGION_PAGE_SIZE).
 * Pages past MAX_DIRECTORY_PAGE return empty (no deep OFFSET). One 57014 retry;
 * on persistent fault the error is thrown for the route soft-shell.
 */
export async function getFilteredListingsPaged(opts: FilterOpts = {}): Promise<{
  listings: DirectoryListing[];
  hasMore: boolean;
}> {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? REGION_PAGE_SIZE;
  if (page > MAX_DIRECTORY_PAGE) {
    return { listings: [], hasMore: false };
  }

  return withTimeoutRetry(`getFilteredListingsPaged(p=${page})`, async () => {
    const supabase = await createServiceRoleClient();
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
      .eq("is_active", true)
      .neq("is_published", false);

    if (opts.region) q = q.eq("province", opts.region);
    if (opts.citySlug) q = q.eq("city_slug", opts.citySlug);
    if (opts.query) q = q.ilike("name", `%${opts.query}%`);
    if (specFilterIds) q = q.in("id", specFilterIds);

    q = q
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("google_review_count", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    const { data, error } = await q;
    if (error) {
      throw Object.assign(new Error(error.message), {
        code: (error as { code?: string }).code,
      });
    }
    if (!data) return { listings: [], hasMore: false };

    const hasMore = data.length > perPage;
    const listings = (hasMore ? data.slice(0, perPage) : data) as unknown as DirectoryListing[];
    return { listings, hasMore };
  });
}
