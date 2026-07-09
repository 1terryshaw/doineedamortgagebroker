// src/lib/uk-mortgage.ts — UK MORTGAGE-BROKER DIRECTORY DATA LAYER (/uk subtree)
//
// PARALLEL to the US/CA mortgage_listings layer — it reuses ONLY the service-role
// Supabase client. It reads the SEPARATE, is_published-gated `uk_mortgage_brokers`
// table (FCA-primary partition over Companies House SIC 66190/66220; firm-grain;
// AR/DA flagged) and its two stat views. Nothing here touches mortgage_listings, the
// US/CA claim flow, jurisdiction.ts, or any NEXT_PUBLIC_COUNTRY-keyed chrome.
//
// Geo hierarchy: county -> town -> firm. Firm slug = company_number (stable, immune to
// geo corrections). Town hubs render only at >= N firms (thin-content guard); a
// sub-threshold town's firms still publish, get firm pages, and list on the county page.
import { supabaseAdmin } from "@/lib/supabase-admin";

export const UK_TABLE = "uk_mortgage_brokers";
export const COUNTY_STATS_VIEW = "uk_mortgage_brokers_county_stats";
export const TOWN_STATS_VIEW = "uk_mortgage_brokers_town_stats";

// UK brand constants — deliberately NOT sourced from lib/jurisdiction (US/CA-keyed) or
// lib/constants (imports jurisdiction). The /uk subtree is self-contained so no
// US-regulatory string can reach a UK page through a shared module.
export const UK_BRAND = "DoINeedAMortgageBroker";
export const UK_DOMAIN = "doineedamortgagebroker.com";
export const UK_PRIMARY_COLOR = "#0d9488"; // teal-600 (matches the repo's teal family)

// Thin-content threshold: generate a town hub page only when it has >= this many firms.
export const TOWN_PAGE_MIN_FIRMS = 3;
// User-facing hub list cap. Full crawl coverage of every firm comes from the sitemap.
const FIRM_LIST_CAP = 200;
// Range page size for sitemap enumeration.
const PAGE_SIZE = 50_000;

export interface UkFirm {
  id: string;
  business_name: string;
  source: string | null;
  source_profile_url: string | null;
  company_number: string | null;
  company_type: string | null;
  registered_address: string | null;
  town: string | null;
  county: string | null;
  region: string | null;
  postcode: string | null;
  sic_code: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  is_published: boolean;
  is_claimed: boolean | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string | null;
  // ---- additive FCA firm-grain fields ----
  frn: string | null;
  authorisation_status: string | null;
  ar_or_da: string | null; // 'DA' | 'AR'
  principal_frn: string | null;
}

export interface CountyStat {
  county: string;
  county_slug: string;
  firm_count: number;
}

export interface TownStat {
  county: string;
  town: string;
  county_slug: string;
  town_slug: string;
  firm_count: number;
}

const FIRM_COLS =
  "id, business_name, source, source_profile_url, company_number, company_type, registered_address, town, county, region, postcode, sic_code, website, email, phone, is_published, is_claimed, owner_email, created_at, updated_at, frn, authorisation_status, ar_or_da, principal_frn";

/**
 * Slugify a county/town name for /uk URLs.
 *
 * MUST stay byte-for-byte identical to the slug expression in the stat views
 * (lower -> runs of [^a-z0-9] become '-' -> trim leading/trailing '-') so a route
 * param produced here resolves against the *_slug columns in the views.
 */
export function ukSlugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Geo hubs (read the cheap, is_published-gated stat views) ---

export async function getUkCounties(): Promise<CountyStat[]> {
  const { data, error } = await supabaseAdmin
    .from(COUNTY_STATS_VIEW)
    .select("county, county_slug, firm_count")
    .order("county", { ascending: true })
    .limit(5000);
  if (error) {
    console.error("getUkCounties error:", error.message);
    return [];
  }
  return (data ?? []) as CountyStat[];
}

export async function getUkCountyBySlug(countySlug: string): Promise<CountyStat | null> {
  const { data, error } = await supabaseAdmin
    .from(COUNTY_STATS_VIEW)
    .select("county, county_slug, firm_count")
    .eq("county_slug", countySlug)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getUkCountyBySlug error:", error.message);
    return null;
  }
  return (data as CountyStat) ?? null;
}

/** Town HUBS within a county (>= minFirms). Drives the "browse by town" section. */
export async function getUkTownsInCounty(
  countySlug: string,
  minFirms = TOWN_PAGE_MIN_FIRMS
): Promise<TownStat[]> {
  const { data, error } = await supabaseAdmin
    .from(TOWN_STATS_VIEW)
    .select("county, town, county_slug, town_slug, firm_count")
    .eq("county_slug", countySlug)
    .gte("firm_count", minFirms)
    .order("firm_count", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("getUkTownsInCounty error:", error.message);
    return [];
  }
  return (data ?? []) as TownStat[];
}

/**
 * A single town group (any size). The caller enforces the thin-content gate by 404-ing
 * when firm_count < TOWN_PAGE_MIN_FIRMS, so a sub-threshold town never renders a hub.
 */
export async function getUkTownBySlug(
  countySlug: string,
  townSlug: string
): Promise<TownStat | null> {
  const { data, error } = await supabaseAdmin
    .from(TOWN_STATS_VIEW)
    .select("county, town, county_slug, town_slug, firm_count")
    .eq("county_slug", countySlug)
    .eq("town_slug", townSlug)
    .order("firm_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getUkTownBySlug error:", error.message);
    return null;
  }
  return (data as TownStat) ?? null;
}

/** All town hubs across all counties (>= minFirms) — for sitemap chunk 0. */
export async function getUkAllTownHubs(
  minFirms = TOWN_PAGE_MIN_FIRMS
): Promise<TownStat[]> {
  const { data, error } = await supabaseAdmin
    .from(TOWN_STATS_VIEW)
    .select("county, town, county_slug, town_slug, firm_count")
    .gte("firm_count", minFirms)
    .order("county_slug", { ascending: true })
    .limit(100_000);
  if (error) {
    console.error("getUkAllTownHubs error:", error.message);
    return [];
  }
  return (data ?? []) as TownStat[];
}

// --- Firms ---

/** A single published firm by its company_number slug. Null-geo rows are never published. */
export async function getUkFirm(companyNumber: string): Promise<UkFirm | null> {
  const { data, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select(FIRM_COLS)
    .eq("company_number", companyNumber)
    .eq("is_published", true)
    .maybeSingle();
  if (error) {
    console.error(`getUkFirm("${companyNumber}") error:`, error.message);
    return null;
  }
  return (data as UkFirm | null) ?? null;
}

/**
 * Firm lookup for the CLAIM flow — by company_number, regardless of geo, but still only
 * published rows (you cannot claim an invisible listing).
 */
export async function getUkFirmForClaim(companyNumber: string): Promise<UkFirm | null> {
  return getUkFirm(companyNumber);
}

export async function getUkFirmsByCounty(
  county: string,
  limit = FIRM_LIST_CAP
): Promise<UkFirm[]> {
  const { data, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select(FIRM_COLS)
    .eq("is_published", true)
    .eq("county", county)
    .order("is_claimed", { ascending: false, nullsFirst: false })
    .order("business_name", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("getUkFirmsByCounty error:", error.message);
    return [];
  }
  return (data ?? []) as UkFirm[];
}

export async function getUkFirmsByTown(
  county: string,
  town: string,
  limit = FIRM_LIST_CAP
): Promise<UkFirm[]> {
  const { data, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select(FIRM_COLS)
    .eq("is_published", true)
    .eq("county", county)
    .eq("town", town)
    .order("is_claimed", { ascending: false, nullsFirst: false })
    .order("business_name", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("getUkFirmsByTown error:", error.message);
    return [];
  }
  return (data ?? []) as UkFirm[];
}

// --- Sitemap helpers ---

/** Count of published, geo-complete firms (= the firm-page universe). */
export async function getUkPublishedCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("is_published", true)
    .not("county", "is", null)
    .not("town", "is", null);
  if (error) {
    console.error("getUkPublishedCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** A window of published firm slugs for a sitemap chunk. */
export async function getUkFirmsRange(
  offset: number,
  limit: number
): Promise<Array<{ company_number: string | null; updated_at: string | null; created_at: string }>> {
  if (limit <= 0) return [];
  const all: Array<{ company_number: string | null; updated_at: string | null; created_at: string }> = [];
  const end = offset + limit;
  let from = offset;
  while (from < end) {
    const to = Math.min(from + PAGE_SIZE, end) - 1;
    const { data, error } = await supabaseAdmin
      .from(UK_TABLE)
      .select("company_number, updated_at, created_at")
      .eq("is_published", true)
      .not("county", "is", null)
      .not("town", "is", null)
      .order("company_number", { ascending: true })
      .range(from, to);
    if (error) {
      console.error("getUkFirmsRange error:", error.message);
      return all;
    }
    const page = data ?? [];
    all.push(...(page as typeof all));
    if (page.length < to - from + 1) break;
    from = to + 1;
  }
  return all;
}
