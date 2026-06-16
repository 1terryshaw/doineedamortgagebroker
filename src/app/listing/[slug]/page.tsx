import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SITE_NAME, SITE_URL, INQUIRY_NO_EMAIL_POLICY } from "@/lib/constants";
import { hasDeliverableEmail } from "@/lib/inquiry-guard";
import { COUNTRY } from "@/lib/country";
import { getPhotoUrls } from "@/lib/listing-media";
import { Listing } from "@/types";
import InquiryForm from "@/components/InquiryForm";
import { LocalBusinessJsonLd } from "@/components/JsonLd";
import FAQSection from "@/components/FAQSection";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getListing(slug: string): Promise<Listing | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("mortgage_listings")
    .select(
      `
      *,
      region:mortgage_regions(*),
      mortgage_listing_specializations(
        specialization_id,
        mortgage_specializations(*)
      )
    `
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("country", COUNTRY)
    .single();

  if (error || !data) return null;

  return data as Listing;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);

  if (!listing) {
    return { title: "Broker Not Found" };
  }

  const cityName = listing.city || listing.state_province || "the US";
  const ratingText = listing.google_rating
    ? ` Rated ${listing.google_rating.toFixed(1)}/5.`
    : "";
  const description =
    listing.bio?.slice(0, 160) ||
    `${listing.name} is a mortgage broker in ${cityName}.${ratingText} View ratings, specializations, and contact information.`;

  const stateLabel = listing.state_province || listing.province || "US";
  const title = `${listing.name} \u2014 Mortgage Broker in ${cityName}, ${stateLabel} | ${SITE_NAME}`;
  const ogImage = listing.hero_image_url || listing.photo_url || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(ogImage && { images: [{ url: ogImage }] }),
    },
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { slug } = await params;
  const listing = await getListing(slug);

  if (!listing) {
    notFound();
  }

  const specializations =
    listing.mortgage_listing_specializations?.map(
      (ls) => ls.mortgage_specializations
    ) || [];

  const stateLabel = listing.state_province || listing.province || "US";

  // Build address without duplicating city/province that may already be in the address string
  const addressAlreadyHasCity =
    listing.address && listing.city && listing.address.includes(listing.city);
  const fullAddress = addressAlreadyHasCity
    ? [listing.address, listing.postal_code].filter(Boolean).join(", ")
    : [listing.address, listing.city, listing.province, listing.postal_code]
        .filter(Boolean)
        .join(", ");

  const listingUrl = `${SITE_URL}/listing/${listing.slug}`;
  const galleryUrls = getPhotoUrls(listing.cached_photos);
  const fallbackUrls = [listing.hero_image_url, listing.photo_url].filter(
    Boolean
  ) as string[];
  const images =
    galleryUrls.length > 0
      ? galleryUrls
      : fallbackUrls.length > 0
        ? fallbackUrls
        : undefined;

  const faqItems = [
    {
      question: `What mortgage services does ${listing.name} offer?`,
      answer: specializations.length > 0
        ? `${listing.name} specializes in ${specializations.map((s) => s.name).join(", ")}. Contact them directly to learn more about their full range of mortgage services.`
        : `${listing.name} offers mortgage brokerage services in ${listing.city || stateLabel}. Contact them directly to learn more about their specific mortgage products and services.`,
    },
    {
      question: `Where is ${listing.name} located?`,
      answer: fullAddress
        ? `${listing.name} is located at ${fullAddress}. You can contact them directly for directions or to schedule a consultation.`
        : `${listing.name} is based in ${listing.city || stateLabel}. Contact them directly for their exact location and to schedule a consultation.`,
    },
    {
      question: `How do I contact ${listing.name}?`,
      answer: [
        listing.phone ? `by phone at ${listing.phone}` : null,
        listing.website ? `through their website` : null,
        `or by filling out the inquiry form on this page`,
      ]
        .filter(Boolean)
        .join(", ")
        .replace(/,([^,]*)$/, ", or$1")
        .replace(/^/, `You can reach ${listing.name} `) + ".",
    },
    {
      question: `Is ${listing.name} accepting new clients?`,
      answer: `To find out if ${listing.name} is currently accepting new clients, we recommend reaching out directly using the contact information on this page or submitting an inquiry through our form.`,
    },
    {
      question: `What do clients say about ${listing.name}?`,
      answer: listing.google_rating
        ? `${listing.name} has a Google rating of ${listing.google_rating.toFixed(1)} out of 5 based on ${listing.google_review_count} review${listing.google_review_count === 1 ? "" : "s"}. Check their Google Business profile for detailed client reviews.`
        : `Visit ${listing.name}'s Google Business profile to read client reviews and learn about their reputation in the community.`,
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <LocalBusinessJsonLd
        name={listing.name}
        description={listing.bio || undefined}
        url={listingUrl}
        phone={listing.phone || undefined}
        address={listing.address || undefined}
        city={listing.city || undefined}
        province={listing.province}
        latitude={listing.latitude || undefined}
        longitude={listing.longitude || undefined}
        rating={listing.google_rating || undefined}
        reviewCount={listing.google_review_count || undefined}
        images={images}
      />

      {/* Breadcrumb */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center space-x-2 text-sm text-gray-500">
            <li>
              <Link href="/" className="hover:text-teal-600 transition-colors">
                Home
              </Link>
            </li>
            <li>
              <span className="mx-1">/</span>
            </li>
            <li>
              <Link
                href="/search"
                className="hover:text-teal-600 transition-colors"
              >
                Find a Broker
              </Link>
            </li>
            <li>
              <span className="mx-1">/</span>
            </li>
            <li className="text-[#1B2A4A] font-medium truncate max-w-[200px] sm:max-w-none">
              {listing.name}
            </li>
          </ol>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {(listing.hero_image_url || listing.photo_url) && (
                <div className="h-48 sm:h-64 w-full overflow-hidden">
                  <img
                    src={listing.hero_image_url || listing.photo_url || undefined}
                    alt={`${listing.name} cover`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  {listing.photo_url && (
                    <img
                      src={listing.photo_url}
                      alt={`${listing.name} logo`}
                      className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#1B2A4A]">
                      {listing.name}
                    </h1>
                    {listing.city && (
                      <p className="text-gray-500 mt-1">
                        {listing.city}, {listing.province}
                      </p>
                    )}
                  </div>
                </div>

                {/* Google Rating */}
                {listing.google_rating && (
                  <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-5 h-5 ${
                            star <= Math.round(listing.google_rating!)
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-lg font-semibold text-[#1B2A4A]">
                      {listing.google_rating.toFixed(1)}
                    </span>
                    <span className="text-gray-500 text-sm">
                      ({listing.google_review_count}{" "}
                      {listing.google_review_count === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                )}

                {/* License & Experience */}
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                  {listing.license_number && (
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4 text-teal-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      License: {listing.license_number}
                    </span>
                  )}
                  {listing.years_experience && (
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4 text-teal-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {listing.years_experience}+ years in business
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {listing.bio && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-[#1B2A4A] mb-4">
                  About {listing.name}
                </h2>
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {listing.bio}
                </div>
              </div>
            )}

            {/* Specializations */}
            {specializations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-[#1B2A4A] mb-4">
                  Specializations
                </h2>
                <div className="flex flex-wrap gap-2">
                  {specializations.map((spec) => (
                    <span
                      key={spec.id}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-teal-50 text-teal-700 border border-teal-200"
                    >
                      {spec.icon && <span className="mr-1.5">{spec.icon}</span>}
                      {spec.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {listing.languages && listing.languages.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-[#1B2A4A] mb-4">
                  Languages Spoken
                </h2>
                <div className="flex flex-wrap gap-2">
                  {listing.languages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-[#1B2A4A]/5 text-[#1B2A4A] border border-[#1B2A4A]/10"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ Section */}
            <FAQSection items={faqItems} />

            {/* Inquiry Form */}
            <div
              id="inquiry-form"
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8"
            >
              {hasDeliverableEmail(listing) ||
              INQUIRY_NO_EMAIL_POLICY === "capture" ? (
                <>
                  <h2 className="text-xl font-semibold text-[#1B2A4A] mb-4">
                    Send an Inquiry
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Interested in working with {listing.name}? Fill out
                    the form below and they will get back to you shortly.
                  </p>
                  <InquiryForm
                    listingId={listing.id}
                    brokerName={listing.name}
                  />
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-[#1B2A4A] mb-2">
                    Is this your business?
                  </h2>
                  <p className="text-gray-600 mb-5">
                    Claim this listing to manage your profile and receive
                    customer inquiries directly.
                  </p>
                  <a
                    href="/signup"
                    className="inline-flex items-center rounded-lg bg-[#1B2A4A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#152238] transition-colors"
                  >
                    Claim this listing &rarr;
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-[#1B2A4A] mb-4">
                Contact Information
              </h2>

              <div className="space-y-4">
                {listing.phone && (
                  <a
                    href={`tel:${listing.phone}`}
                    className="flex items-center gap-3 text-gray-700 hover:text-teal-600 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                      <svg
                        className="w-5 h-5 text-teal-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm break-all">{listing.phone}</span>
                  </a>
                )}


                {listing.website && (
                  <a
                    href={
                      listing.website.startsWith("http")
                        ? listing.website
                        : `https://${listing.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-gray-700 hover:text-teal-600 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                      <svg
                        className="w-5 h-5 text-teal-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                        />
                      </svg>
                    </div>
                    <span className="text-sm break-all">
                      {listing.website.replace(/^https?:\/\//, "")}
                    </span>
                  </a>
                )}

                {fullAddress && (
                  <div className="flex items-start gap-3 text-gray-700">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-5 h-5 text-teal-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm">{fullAddress}</span>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <a
                href="#inquiry-form"
                className="mt-6 block w-full text-center px-6 py-3 bg-[#1B2A4A] text-white font-semibold rounded-lg hover:bg-[#152238] transition-colors"
              >
                Contact This Broker
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
