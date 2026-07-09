import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getUkCountyBySlug,
  getUkTownsInCounty,
  getUkFirmsByCounty,
} from "@/lib/uk-mortgage";
import {
  ukBreadcrumbSchema,
  ukCollectionPageSchema,
  ukPageMetadata,
} from "@/lib/uk-seo";
import UkListingCard from "@/components/uk/UkListingCard";
import UkShareButtons from "@/components/uk/UkShareButtons";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ county: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { county } = await params;
  const countyData = await getUkCountyBySlug(county);
  if (!countyData) return { title: "Not Found" };
  return ukPageMetadata({
    title: `Mortgage Brokers in ${countyData.county} | DoINeedAMortgageBroker`,
    description: `Find FCA-authorised mortgage brokers in ${countyData.county}, UK. Browse ${Number(
      countyData.firm_count
    ).toLocaleString("en-GB")} listings by town, with registered details and contact information.`,
    path: `/uk/${county}`,
  });
}

export default async function UkCountyPage({ params }: Props) {
  const { county } = await params;
  const countyData = await getUkCountyBySlug(county);
  if (!countyData) notFound();

  const [towns, firms] = await Promise.all([
    getUkTownsInCounty(county),
    getUkFirmsByCounty(countyData.county),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukBreadcrumbSchema([{ name: countyData.county, path: `/uk/${county}` }])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukCollectionPageSchema(
              `Mortgage Brokers in ${countyData.county}`,
              `/uk/${county}`,
              Number(countyData.firm_count),
              countyData.county
            )
          ),
        }}
      />

      <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <Link href="/uk" className="hover:underline">UK Mortgage Brokers</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{countyData.county}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2 text-gray-900">
        Mortgage Brokers in {countyData.county}
      </h1>
      <div className="mb-4">
        <UkShareButtons variant="compact" title={`Mortgage Brokers in ${countyData.county}`} />
      </div>
      <p className="text-gray-600 mb-8">
        {Number(countyData.firm_count).toLocaleString("en-GB")} FCA-authorised mortgage firms in{" "}
        {countyData.county}, United Kingdom.
      </p>

      {towns.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">Browse by town</h2>
          <div className="flex flex-wrap gap-2">
            {towns.map((t) => (
              <Link
                key={t.town_slug}
                href={`/uk/${county}/${t.town_slug}`}
                className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-sm bg-white hover:shadow-md hover:border-gray-300 transition-all"
              >
                <span className="text-gray-800">{t.town}</span>
                <span className="text-xs text-gray-400">
                  {Number(t.firm_count).toLocaleString("en-GB")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Firms in {countyData.county}</h2>
        {firms.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No firms to show yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {firms.map((firm) => (
              <UkListingCard key={firm.id} firm={firm} />
            ))}
          </div>
        )}
        {Number(countyData.firm_count) > firms.length && (
          <p className="text-sm text-gray-400 mt-6">
            Showing {firms.length} of{" "}
            {Number(countyData.firm_count).toLocaleString("en-GB")} firms. Narrow by town
            above to see more.
          </p>
        )}
      </section>
    </div>
  );
}
