import Link from "next/link";
import {
  getDirectoryRegions,
  getFilteredListingsPaged,
  getListingsCount,
  getSpecializations,
  specializationsEnabled,
} from "@/lib/directory-hub";
import SearchBar from "@/components/SearchBar";
import Pagination from "@/components/Pagination";
import ListingCard from "@/components/ListingCard";

export const dynamic = "force-dynamic";

const PAGE_TITLE = "Find a Mortgage Broker | Directory";
const PAGE_DESC =
  "Browse mortgage brokers by province and city across Canada. Compare ratings, reviews, and specializations.";

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESC,
    type: "website",
    url: "https://findmymortgagebroker.ca/directory",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESC,
  },
};

type SP = {
  region?: string;
  city?: string;
  type?: string;
  q?: string;
  page?: string;
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const isFiltered = !!(sp.region || sp.city || sp.type || sp.q);

  const [regions, specsEnabled, paged, totalCount] = await Promise.all([
    getDirectoryRegions(),
    specializationsEnabled(),
    getFilteredListingsPaged({
      region: sp.region,
      citySlug: sp.city,
      specSlug: sp.type,
      query: sp.q,
      page,
    }),
    isFiltered ? Promise.resolve(null) : getListingsCount(),
  ]);

  // Specialization filter is gated: hidden until the join table has tagged rows
  // for this country (currently empty empire-wide → dead UI).
  const specializations = specsEnabled ? await getSpecializations() : [];

  const { listings, hasMore } = paged;

  // Active-filter chip labels
  const chips: Array<{ label: string; href: string }> = [];
  if (sp.region) {
    const r = regions.find((x) => x.province === sp.region);
    chips.push({
      label: `Province: ${r?.name ?? sp.region}`,
      href: buildHrefWithout(sp, "region", "city"),
    });
  }
  if (sp.city) {
    const r = regions.find((x) => x.province === sp.region);
    const c = r?.cities.find((x) => x.city_slug === sp.city);
    chips.push({
      label: `City: ${c?.city ?? sp.city}`,
      href: buildHrefWithout(sp, "city"),
    });
  }
  if (sp.type) {
    const s = specializations.find((x) => x.slug === sp.type);
    chips.push({
      label: `Specialization: ${s?.name ?? sp.type}`,
      href: buildHrefWithout(sp, "type"),
    });
  }
  if (sp.q) {
    chips.push({
      label: `Search: "${sp.q}"`,
      href: buildHrefWithout(sp, "q"),
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Mortgage Broker Directory",
    description: PAGE_DESC,
    url: "https://findmymortgagebroker.ca/directory",
  };

  // Pagination needs string-only searchParams (no `page` key — Pagination owns it)
  const paginationParams: Record<string, string> = {};
  if (sp.region) paginationParams.region = sp.region;
  if (sp.city) paginationParams.city = sp.city;
  if (sp.type) paginationParams.type = sp.type;
  if (sp.q) paginationParams.q = sp.q;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Find a Mortgage Broker
        </h1>
        <p className="mt-2 text-gray-600">
          {totalCount !== null
            ? `${totalCount.toLocaleString()} brokers across Canada`
            : "Browse by location and specialization"}
        </p>
      </header>

      <SearchBar regions={regions} specializations={specializations} />

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip, i) => (
            <Link
              key={i}
              href={chip.href}
              className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
            >
              {chip.label}
              <span className="ml-2 text-blue-500">×</span>
            </Link>
          ))}
          <Link
            href="/directory"
            className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
          >
            Reset all
          </Link>
        </div>
      )}

      <div className="mt-6">
        {listings.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-600">No brokers match your filters.</p>
            <Link
              href="/directory"
              className="mt-3 inline-block text-blue-600 hover:underline"
            >
              Reset filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l as never} />
            ))}
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        hasMore={hasMore}
        basePath="/directory"
        searchParams={paginationParams}
      />
    </main>
  );
}

function buildHrefWithout(sp: SP, ...keysToRemove: string[]): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "page" && !keysToRemove.includes(k)) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/directory?${qs}` : "/directory";
}
