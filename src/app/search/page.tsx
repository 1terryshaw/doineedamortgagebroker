import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ITEMS_PER_PAGE, SITE_NAME, SITE_URL, SORT_OPTIONS } from "@/lib/constants";
import { COUNTRY, PROVINCE_WHITELIST } from "@/lib/country";
import type { Listing, Region, Specialization, SearchParams } from "@/types";
import ListingCard from "@/components/ListingCard";
import { ItemListJsonLd } from "@/components/JsonLd";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Find a Mortgage Broker | ${SITE_NAME}`,
  description:
    "Search and compare licensed mortgage brokers and loan originators in the United States. Filter by city, specialization, and rating to find the right broker for your needs.",
};

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const {
    city,
    specialization,
    rating,
    sort = "rating",
    page = "1",
    q,
  } = params;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  const supabase = await createServerSupabaseClient();

  // Fetch filter options in parallel
  const [{ data: regions }, { data: specializations }] = await Promise.all([
    supabase
      .from("mortgage_regions")
      .select("*")
      .in("province", PROVINCE_WHITELIST[COUNTRY])
      .order("name", { ascending: true }),
    supabase
      .from("mortgage_specializations")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  const allRegions = (regions as Region[] | null) ?? [];
  const allSpecializations = (specializations as Specialization[] | null) ?? [];

  // Build query for listings
  let query = supabase
    .from("mortgage_listings")
    .select(
      `
      *,
      mortgage_listing_specializations(
        specialization_id,
        mortgage_specializations(*)
      )
    `,
      { count: "exact" }
    )
    .eq("is_active", true)
    .eq("country", COUNTRY);

  // Apply filters
  if (city) {
    // Look up region by slug to get city name
    const region = allRegions.find((r) => r.slug === city);
    if (region) {
      query = query.eq("region_id", region.id);
    }
  }

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  if (rating) {
    const minRating = parseFloat(rating);
    if (!isNaN(minRating)) {
      query = query.gte("google_rating", minRating);
    }
  }

  // Sort
  switch (sort) {
    case "reviews":
      query = query.order("google_review_count", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "rating":
    default:
      query = query
        .order("is_premium", { ascending: false })
        .order("google_rating", { ascending: false, nullsFirst: false });
      break;
  }

  // Pagination
  query = query.range(offset, offset + ITEMS_PER_PAGE - 1);

  const { data: listings, count } = await query;

  let filteredListings = (listings as Listing[] | null) ?? [];

  // Post-filter by specialization (requires join filtering)
  if (specialization) {
    const spec = allSpecializations.find((s) => s.slug === specialization);
    if (spec) {
      filteredListings = filteredListings.filter((listing) =>
        listing.mortgage_listing_specializations?.some(
          (ls) => ls.specialization_id === spec.id
        )
      );
    }
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Build URL helper for pagination / filter links
  function buildSearchUrl(overrides: Partial<SearchParams>): string {
    const merged = { city, specialization, rating, sort, q, ...overrides };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) sp.set(key, value);
    });
    return `/search?${sp.toString()}`;
  }

  const activeCity = allRegions.find((r) => r.slug === city);
  const activeSpec = allSpecializations.find((s) => s.slug === specialization);

  const itemListItems = filteredListings.map((listing, index) => ({
    name: listing.name,
    url: `${SITE_URL}/listing/${listing.slug}`,
    position: index + 1,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {itemListItems.length > 0 && (
        <ItemListJsonLd items={itemListItems} listName="Mortgage Broker Search Results" />
      )}

      {/* Page header */}
      <div className="bg-gradient-to-br from-[#0f2a4a] to-[#1a3a5c]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-4">
            <ol className="flex items-center gap-2 text-sm text-navy-300">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li className="text-white font-medium">Search</li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {activeSpec && activeCity
              ? `${activeSpec.name} Mortgage Brokers in ${activeCity.name}`
              : activeCity
                ? `Mortgage Brokers in ${activeCity.name}`
                : activeSpec
                  ? `${activeSpec.name} Mortgage Brokers`
                  : "Find a Mortgage Broker"}
          </h1>
          <p className="mt-2 text-navy-300">
            {totalCount} broker{totalCount !== 1 ? "s" : ""} found
            {q ? ` for "${q}"` : ""}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar filters */}
          <aside className="w-full shrink-0 lg:w-64">
            <form action="/search" method="get">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[#0f2a4a]">
                  Filters
                </h2>

                {/* Search query */}
                <div className="mt-5">
                  <label
                    htmlFor="q"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Search
                  </label>
                  <input
                    type="text"
                    id="q"
                    name="q"
                    defaultValue={q ?? ""}
                    placeholder="Broker name..."
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {/* City dropdown */}
                <div className="mt-5">
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-gray-700"
                  >
                    City
                  </label>
                  <select
                    id="city"
                    name="city"
                    defaultValue={city ?? ""}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">All Cities</option>
                    {allRegions.map((region) => (
                      <option key={region.id} value={region.slug}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specialization checkboxes */}
                <fieldset className="mt-5">
                  <legend className="block text-sm font-medium text-gray-700">
                    Specialization
                  </legend>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {allSpecializations.map((spec) => (
                      <label
                        key={spec.id}
                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="specialization"
                          value={spec.slug}
                          defaultChecked={specialization === spec.slug}
                          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        {spec.name}
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="specialization"
                        value=""
                        defaultChecked={!specialization}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      All Specializations
                    </label>
                  </div>
                </fieldset>

                {/* Minimum rating */}
                <div className="mt-5">
                  <label
                    htmlFor="rating"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Minimum Rating
                  </label>
                  <select
                    id="rating"
                    name="rating"
                    defaultValue={rating ?? ""}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">Any Rating</option>
                    <option value="3">3+ Stars</option>
                    <option value="3.5">3.5+ Stars</option>
                    <option value="4">4+ Stars</option>
                    <option value="4.5">4.5+ Stars</option>
                  </select>
                </div>

                {/* Sort */}
                <div className="mt-5">
                  <label
                    htmlFor="sort"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Sort By
                  </label>
                  <select
                    id="sort"
                    name="sort"
                    defaultValue={sort}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="mt-6 w-full rounded-lg bg-[#0f2a4a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a3a5c] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                >
                  Apply Filters
                </button>

                {/* Clear filters */}
                <Link
                  href="/search"
                  className="mt-2 block w-full text-center text-sm text-gray-500 hover:text-teal-600 transition-colors"
                >
                  Clear all filters
                </Link>
              </div>
            </form>
          </aside>

          {/* Results */}
          <div className="flex-1">
            {/* Active filters */}
            {(activeCity || activeSpec || q || rating) && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">Active filters:</span>
                {activeCity && (
                  <Link
                    href={buildSearchUrl({ city: undefined, page: "1" })}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20 hover:bg-teal-100 transition-colors"
                  >
                    {activeCity.name}
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Link>
                )}
                {activeSpec && (
                  <Link
                    href={buildSearchUrl({
                      specialization: undefined,
                      page: "1",
                    })}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20 hover:bg-teal-100 transition-colors"
                  >
                    {activeSpec.name}
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Link>
                )}
                {q && (
                  <Link
                    href={buildSearchUrl({ q: undefined, page: "1" })}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20 hover:bg-teal-100 transition-colors"
                  >
                    &quot;{q}&quot;
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Link>
                )}
                {rating && (
                  <Link
                    href={buildSearchUrl({ rating: undefined, page: "1" })}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20 hover:bg-teal-100 transition-colors"
                  >
                    {rating}+ Stars
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Link>
                )}
              </div>
            )}

            {/* Results grid */}
            {filteredListings.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-[#0f2a4a]">
                  No brokers found
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Try adjusting your filters or search query.
                </p>
                <Link
                  href="/search"
                  className="mt-4 inline-flex items-center text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  Clear all filters
                </Link>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                className="mt-8 flex items-center justify-center gap-2"
                aria-label="Pagination"
              >
                {/* Previous */}
                {currentPage > 1 ? (
                  <Link
                    href={buildSearchUrl({ page: String(currentPage - 1) })}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                      />
                    </svg>
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                      />
                    </svg>
                    Previous
                  </span>
                )}

                {/* Page numbers */}
                <div className="hidden items-center gap-1 sm:flex">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    return (
                      <Link
                        key={pageNum}
                        href={buildSearchUrl({ page: String(pageNum) })}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                          pageNum === currentPage
                            ? "bg-[#0f2a4a] text-white"
                            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </Link>
                    );
                  })}
                </div>

                {/* Mobile page indicator */}
                <span className="text-sm text-gray-600 sm:hidden">
                  Page {currentPage} of {totalPages}
                </span>

                {/* Next */}
                {currentPage < totalPages ? (
                  <Link
                    href={buildSearchUrl({ page: String(currentPage + 1) })}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Next
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
                    Next
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </span>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
