import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { JURISDICTION } from "@/lib/jurisdiction";
import {
  getDirectoryRegions,
  getSpecializations,
  specializationsEnabled,
  type DirectoryRegion,
} from "@/lib/directory-hub";
import { WebSiteJsonLd, OrganizationJsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Listing-derived regions (full province + city coverage) — replaces the
  // legacy mortgage_regions source, which only held ON (CA) / FL (US) and made
  // the homepage look province-locked. /directory is the canonical search surface.
  const regions = await getDirectoryRegions();

  // Specialization tiles are gated: mortgage_listing_specializations is empty,
  // so the tiles would all be dead links. Only fetch + render when tagged.
  const specsEnabled = await specializationsEnabled();
  const specs = specsEnabled ? await getSpecializations() : [];

  return (
    <>
      <WebSiteJsonLd
        name={SITE_NAME}
        url={SITE_URL}
        description={JURISDICTION.homeWebsiteDesc}
      />
      <OrganizationJsonLd
        name={SITE_NAME}
        url={SITE_URL}
        description={JURISDICTION.homeOrgDesc}
      />

      <section className="gradient-hero relative overflow-hidden">
        <div className="gradient-hero-overlay absolute inset-0" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
              Find the Right{" "}
              <span className="text-gradient">Mortgage Broker</span>
              <br className="hidden sm:inline" /> for Your Situation
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-navy-300 sm:mt-6 sm:text-lg md:text-xl">
              {JURISDICTION.heroSubcopy}
            </p>

            <HeroSearchBar regions={regions} />

            <p className="mt-4 text-sm text-navy-400">
              {JURISDICTION.heroSourcedLine} &middot; Not financial advice
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="section-heading">Browse by Region</h2>
            <p className="section-subheading">
              Find mortgage brokers in your area
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {regions.map((region) => (
              <Link
                key={region.province}
                href={`/directory?region=${region.province}`}
                className="group flex flex-col items-center rounded-xl border border-navy-100 bg-white p-4 text-center transition-all hover:border-teal-200 hover:shadow-md sm:p-5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 transition-colors group-hover:bg-teal-50">
                  <svg
                    className="h-6 w-6 text-navy-400 transition-colors group-hover:text-teal-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                </div>
                <span className="mt-3 text-sm font-semibold text-navy-800 group-hover:text-teal-700">
                  {region.name}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/directory"
              className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 transition-colors hover:text-teal-700"
            >
              Browse the full directory
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
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {specsEnabled && specs.length > 0 && (
        <section className="bg-navy-50 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="section-heading">Browse by Specialization</h2>
              <p className="section-subheading">
                Find brokers who specialize in your mortgage needs
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {specs.map((spec) => (
                <Link
                  key={spec.slug}
                  href={`/directory?type=${spec.slug}`}
                  className="group flex items-start gap-4 rounded-xl border border-navy-100 bg-white p-5 transition-all hover:border-teal-200 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-lg transition-colors group-hover:bg-teal-100">
                    {spec.icon || getSpecIcon(spec.slug)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900 group-hover:text-teal-700">
                      {spec.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="gradient-hero relative overflow-hidden rounded-2xl px-6 py-12 sm:px-12 sm:py-16">
            <div className="gradient-hero-overlay absolute inset-0" />
            <div className="relative mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Are You a Licensed Mortgage Broker?
              </h2>
              <p className="mt-3 text-base text-navy-300 sm:text-lg">
                Claim your free listing on {SITE_NAME} and connect with
                qualified leads in your area. Showcase your expertise, collect
                reviews, and grow your business.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/directory" className="btn-primary px-8 py-3 text-base">
                  Browse the Directory
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-1 text-sm font-medium text-navy-200 transition-colors hover:text-white"
                >
                  Learn more
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
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// Server-rendered hero search. Province dropdown is listing-derived (all
// provinces with data); submits to /directory, the canonical search surface,
// where the province→city cascade and name/specialization filters live.
function HeroSearchBar({ regions }: { regions: DirectoryRegion[] }) {
  return (
    <form
      action="/directory"
      method="get"
      className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:mt-10 sm:flex-row"
    >
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          name="q"
          placeholder={JURISDICTION.searchPlaceholder}
          className="w-full rounded-lg border-0 bg-white py-3 pl-10 pr-4 text-sm text-navy-900 shadow-sm placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <select
        name="region"
        defaultValue=""
        aria-label="Region"
        className="rounded-lg border-0 bg-white py-3 pl-4 pr-8 text-sm text-navy-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 sm:w-44"
      >
        <option value="">All Regions</option>
        {regions.map((region) => (
          <option key={region.province} value={region.province}>
            {region.name}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="btn-primary rounded-lg px-6 py-3 text-sm font-semibold shadow-sm"
      >
        Search
      </button>
    </form>
  );
}

function getSpecIcon(slug: string): string {
  const icons: Record<string, string> = {
    residential: "\u{1F3E0}",
    commercial: "\u{1F3E2}",
    refinancing: "\u{1F504}",
    "first-time-buyer": "\u{1F511}",
    "self-employed": "\u{1F4BC}",
    "investment-property": "\u{1F4C8}",
    "fha-loan": "\u{1F3DB}",
    "va-loan": "\u{1F396}",
    "usda-loan": "\u{1F33E}",
    "jumbo-loan": "\u{1F4B0}",
    "reverse-mortgage": "\u{1F501}",
    construction: "\u{1F3D7}",
    "bad-credit": "\u{1F4B3}",
    "debt-consolidation": "\u{1F4CA}",
  };
  return icons[slug] ?? "\u{2B50}";
}
