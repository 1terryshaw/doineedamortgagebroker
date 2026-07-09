import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getUkFirm,
  getUkTownBySlug,
  ukSlugify,
  TOWN_PAGE_MIN_FIRMS,
  UK_PRIMARY_COLOR,
} from "@/lib/uk-mortgage";
import { ukBreadcrumbSchema, ukFirmSchema, ukPageMetadata } from "@/lib/uk-seo";
import UkShareButtons from "@/components/uk/UkShareButtons";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ slug: string }>;
}

const TYPE_LABEL: Record<string, string> = {
  ltd: "Limited Company",
  plc: "Public Limited Company (PLC)",
  llp: "Limited Liability Partnership (LLP)",
};

const FCA_REGISTER_URL = "https://register.fca.org.uk/";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const firm = await getUkFirm(slug);
  if (!firm) return { title: "Listing Not Found" };
  const where = [firm.town, firm.county].filter(Boolean).join(", ");
  return ukPageMetadata({
    title: `${firm.business_name} | DoINeedAMortgageBroker`,
    description: `${firm.business_name} is an FCA-authorised mortgage firm${
      where ? ` in ${where}` : ""
    }, UK. View registered details, FCA authorisation, and claim this listing.`,
    path: `/uk/directory/${slug}`,
  });
}

export default async function UkFirmPage({ params }: Props) {
  const { slug } = await params;
  const firm = await getUkFirm(slug);
  if (!firm) notFound();

  const countySlug = firm.county ? ukSlugify(firm.county) : null;
  const townSlug = firm.town ? ukSlugify(firm.town) : null;

  // Link the town crumb only when a town hub actually exists (>= N firms); otherwise
  // render it as plain text so the breadcrumb never points at a 404.
  let townHubExists = false;
  if (countySlug && townSlug) {
    const townStat = await getUkTownBySlug(countySlug, townSlug);
    townHubExists = !!townStat && Number(townStat.firm_count) >= TOWN_PAGE_MIN_FIRMS;
  }

  const typeLabel = firm.company_type ? TYPE_LABEL[firm.company_type] ?? firm.company_type : null;
  const arDaLabel =
    firm.ar_or_da === "AR"
      ? "Appointed Representative"
      : firm.ar_or_da === "DA"
      ? "Directly Authorised"
      : null;

  const crumbs: Array<{ name: string; path: string }> = [];
  if (firm.county && countySlug) crumbs.push({ name: firm.county, path: `/uk/${countySlug}` });
  if (firm.town && countySlug && townSlug && townHubExists) {
    crumbs.push({ name: firm.town, path: `/uk/${countySlug}/${townSlug}` });
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ukFirmSchema(firm)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukBreadcrumbSchema([
              ...crumbs,
              { name: firm.business_name, path: `/uk/directory/${slug}` },
            ])
          ),
        }}
      />

      <div className="max-w-5xl mx-auto px-4 py-12">
        <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
          <Link href="/uk" className="hover:underline">UK Mortgage Brokers</Link>
          {firm.county && countySlug && (
            <>
              <span className="mx-2">/</span>
              <Link href={`/uk/${countySlug}`} className="hover:underline">{firm.county}</Link>
            </>
          )}
          {firm.town && (
            <>
              <span className="mx-2">/</span>
              {townHubExists && countySlug && townSlug ? (
                <Link href={`/uk/${countySlug}/${townSlug}`} className="hover:underline">
                  {firm.town}
                </Link>
              ) : (
                <span>{firm.town}</span>
              )}
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <h1 className="text-3xl font-bold text-gray-900">{firm.business_name}</h1>
              {firm.is_claimed && (
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2.5 py-1 rounded-full">
                  &#10003; Verified
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {typeLabel && (
                <span
                  className="inline-block text-xs font-medium px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: `${UK_PRIMARY_COLOR}15`,
                    color: UK_PRIMARY_COLOR,
                  }}
                >
                  {typeLabel}
                </span>
              )}
              {arDaLabel && (
                <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                  {arDaLabel}
                </span>
              )}
            </div>

            {(firm.town || firm.county) && (
              <p className="text-gray-500 mb-4">
                {[firm.town, firm.county].filter(Boolean).join(", ")}
              </p>
            )}

            <div className="bg-gray-100 rounded-xl p-8 text-center mb-8">
              <span className="text-4xl">🏦</span>
              <p className="text-gray-400 text-sm mt-2">
                {firm.business_name} — mortgage firm in {firm.town || firm.county || "the UK"}.
              </p>
            </div>

            {/* Claim CTA — free Verified only this session. Paid GBP tiers are intentionally
                absent now (no broken UI). */}
            {firm.is_claimed ? (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-6 flex items-center gap-3">
                <span className="text-green-600 text-xl">&#10003;</span>
                <div>
                  <p className="font-semibold text-green-800">Verified Business</p>
                  <p className="text-sm text-green-700">
                    This listing has been claimed and verified by the business owner.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="mt-2 bg-gray-50 border border-l-4 rounded-lg p-6"
                style={{ borderLeftColor: UK_PRIMARY_COLOR }}
              >
                <p className="font-semibold">Is this your firm?</p>
                <p className="text-sm text-gray-600 mt-1">
                  Claim this listing to get a free Verified badge and manage your details.
                </p>
                <Link
                  href={`/uk/claim/${slug}`}
                  className="inline-block mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: UK_PRIMARY_COLOR }}
                >
                  Claim Listing (free)
                </Link>
              </div>
            )}

            <div className="mt-8 pt-4 border-t">
              <h2 className="font-semibold text-sm text-gray-500 mb-3">Share this listing</h2>
              <UkShareButtons title={firm.business_name} variant="full" />
            </div>
          </div>

          {/* Sidebar: registered + FCA details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="border rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Registered details</h2>
              <dl className="space-y-3 text-sm">
                {firm.registered_address && (
                  <div>
                    <dt className="text-gray-500">Registered address</dt>
                    <dd className="text-gray-800">{firm.registered_address}</dd>
                  </div>
                )}
                {firm.postcode && (
                  <div>
                    <dt className="text-gray-500">Postcode</dt>
                    <dd className="text-gray-800">{firm.postcode}</dd>
                  </div>
                )}
                {firm.company_number && (
                  <div>
                    <dt className="text-gray-500">Company number</dt>
                    <dd className="text-gray-800">{firm.company_number}</dd>
                  </div>
                )}
                {firm.frn && (
                  <div>
                    <dt className="text-gray-500">FCA Firm Reference Number (FRN)</dt>
                    <dd className="text-gray-800">{firm.frn}</dd>
                  </div>
                )}
                {firm.authorisation_status && (
                  <div>
                    <dt className="text-gray-500">FCA status</dt>
                    <dd className="text-gray-800">{firm.authorisation_status}</dd>
                  </div>
                )}
                {arDaLabel && (
                  <div>
                    <dt className="text-gray-500">Authorisation</dt>
                    <dd className="text-gray-800">{arDaLabel}</dd>
                  </div>
                )}
                {firm.phone && (
                  <div>
                    <dt className="text-gray-500">Phone</dt>
                    <dd>
                      <a
                        href={`tel:${firm.phone}`}
                        className="hover:underline"
                        style={{ color: UK_PRIMARY_COLOR }}
                      >
                        {firm.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {firm.website && (
                  <div>
                    <dt className="text-gray-500">Website</dt>
                    <dd className="break-words">
                      <a
                        href={firm.website}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:underline"
                        style={{ color: UK_PRIMARY_COLOR }}
                      >
                        {firm.website}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              <div className="pt-4 mt-4 border-t space-y-2">
                <a
                  href={FCA_REGISTER_URL}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block text-xs text-gray-500 hover:text-gray-700"
                >
                  Verify this firm on the FCA Register →
                </a>
                {firm.source_profile_url && (
                  <a
                    href={firm.source_profile_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="block text-xs text-gray-400 hover:text-gray-600"
                  >
                    View Companies House record →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
