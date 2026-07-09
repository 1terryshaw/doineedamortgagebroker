import { Metadata } from "next";
import Link from "next/link";
import { getUkCounties, UK_PRIMARY_COLOR } from "@/lib/uk-mortgage";
import { ukBreadcrumbSchema, ukCollectionPageSchema, ukPageMetadata } from "@/lib/uk-seo";
import UkShareButtons from "@/components/uk/UkShareButtons";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TITLE = "Find a Mortgage Broker in the UK | DoINeedAMortgageBroker";
const DESCRIPTION =
  "Browse a directory of FCA-authorised UK mortgage brokers by county and town. Find registered details and contact information, and claim your firm's listing for free.";

export const metadata: Metadata = ukPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/uk",
});

export default async function UkIndexPage() {
  const counties = await getUkCounties();
  const totalFirms = counties.reduce((sum, c) => sum + Number(c.firm_count), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ukBreadcrumbSchema([])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukCollectionPageSchema("UK Mortgage Brokers", "/uk", totalFirms, "the United Kingdom")
          ),
        }}
      />

      <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <span className="text-gray-700">UK Mortgage Brokers</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2 text-gray-900">
        Find a Mortgage Broker in the UK
      </h1>
      <div className="mb-4">
        <UkShareButtons variant="compact" title="UK Mortgage Brokers — DoINeedAMortgageBroker" />
      </div>
      <p className="text-gray-600 mb-8 max-w-3xl">
        Browse {totalFirms.toLocaleString("en-GB")} FCA-authorised mortgage firms across{" "}
        {counties.length} UK counties. Choose a county to find brokers near you, see
        registered details, and connect directly.
      </p>

      {counties.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          UK listings are coming soon. Check back shortly.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {counties.map((c) => (
            <Link
              key={c.county_slug}
              href={`/uk/${c.county_slug}`}
              className="flex items-center justify-between border rounded-lg px-4 py-3 bg-white hover:shadow-md hover:border-gray-300 transition-all"
            >
              <span className="font-medium text-gray-900">{c.county}</span>
              <span className="text-xs text-gray-500">
                {Number(c.firm_count).toLocaleString("en-GB")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
