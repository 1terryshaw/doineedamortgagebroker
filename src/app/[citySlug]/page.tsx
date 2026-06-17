import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { COUNTRY } from "@/lib/country";
import type { Region, Listing, Specialization } from "@/types";
import ListingCard from "@/components/ListingCard";
import { getCardMediaForListings } from "@/lib/listing-photos";
import { ItemListJsonLd } from "@/components/JsonLd";
import FAQSection from "@/components/FAQSection";

interface PageProps {
  params: Promise<{ citySlug: string }>;
}

async function getCity(slug: string): Promise<Region | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("mortgage_regions")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as Region;
}

async function getCityListings(regionId: string): Promise<Listing[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("mortgage_listings")
    .select(
      `
      *,
      mortgage_listing_specializations(
        specialization_id,
        mortgage_specializations(*)
      )
    `
    )
    .eq("region_id", regionId)
    .eq("is_active", true)
    .eq("country", COUNTRY)
    .order("is_premium", { ascending: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .limit(60);

  return (data as Listing[] | null) ?? [];
}

async function getSpecializations(): Promise<Specialization[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("mortgage_specializations")
    .select("*")
    .order("name");

  return (data as Specialization[] | null) ?? [];
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { citySlug } = await params;
  const city = await getCity(citySlug);

  if (!city) {
    return { title: "City Not Found" };
  }

  const title = `Mortgage Brokers in ${city.name}, ${city.province}`;
  const description = `Find and compare the best mortgage brokers in ${city.name}, ${city.province}. Read reviews, check specializations, and connect with trusted mortgage professionals.`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

export default async function CityPage({ params }: PageProps) {
  const { citySlug } = await params;
  const city = await getCity(citySlug);

  if (!city) {
    notFound();
  }

  const [listings, specializations] = await Promise.all([
    getCityListings(city.id),
    getSpecializations(),
  ]);

  // Batched owner media for the cards (one query, no per-card waterfall).
  const cardMedia = await getCardMediaForListings(listings.map((l) => l.id));

  const itemListItems = listings.map((listing, index) => ({
    name: listing.name,
    url: `${SITE_URL}/listing/${listing.slug}`,
    position: index + 1,
  }));

  const faqItems = [
    {
      question: `How do I find a mortgage broker in ${city.name}?`,
      answer: `You can browse our directory of mortgage brokers in ${city.name}, ${city.province} right here on ${SITE_NAME}. Compare ratings, read reviews, check specializations, and contact brokers directly to find the right fit for your mortgage needs.`,
    },
    {
      question: `How much does a mortgage broker cost in ${city.name}?`,
      answer: `Most mortgage brokers in ${city.name} are paid by the lender, not the borrower, so their services are typically free to you. In some cases involving complex or private lending situations, a broker fee may apply. Always ask your broker about their fee structure upfront.`,
    },
    {
      question: `What should I look for when choosing a mortgage broker in ${city.name}?`,
      answer: `When choosing a mortgage broker in ${city.name}, consider their experience, client reviews, specializations, range of lender partnerships, and communication style. A good broker should take time to understand your financial situation and present multiple options.`,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {itemListItems.length > 0 && (
        <ItemListJsonLd items={itemListItems} listName={`Mortgage Brokers in ${city.name}`} />
      )}

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2a4a] via-[#163758] to-teal-800">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <nav className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-navy-300">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link
                  href="/search"
                  className="hover:text-white transition-colors"
                >
                  Search
                </Link>
              </li>
              <li>/</li>
              <li className="text-white font-medium">{city.name}</li>
            </ol>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Mortgage Brokers in{" "}
            <span className="text-teal-400">{city.name}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-navy-300 sm:text-lg">
            Compare top-rated mortgage brokers in {city.name},{" "}
            {city.province}. Read reviews, check specializations, and find the
            right professional for your mortgage needs.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/search?city=${city.slug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600"
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
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              Search All Brokers
            </Link>
            <span className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white">
              {listings.length} broker{listings.length !== 1 ? "s" : ""} found
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Specialization quick links */}
        {specializations.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-[#0f2a4a]">
              Browse by Specialization in {city.name}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {specializations.map((spec) => (
                <Link
                  key={spec.id}
                  href={`/${city.slug}/${spec.slug}`}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#0f2a4a] shadow-sm transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                >
                  {spec.icon && <span className="mr-1.5">{spec.icon}</span>}
                  {spec.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Listings grid */}
        {listings.length > 0 ? (
          <section>
            <h2 className="text-xl font-bold text-[#0f2a4a] sm:text-2xl">
              Top Mortgage Brokers in {city.name}
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  ownerHeroUrl={cardMedia.get(listing.id)?.heroUrl}
                  ownerLogoUrl={cardMedia.get(listing.id)?.logoUrl}
                />
              ))}
            </div>
          </section>
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
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-[#0f2a4a]">
              No brokers found in {city.name} yet
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Check back soon or browse brokers in other cities.
            </p>
            <Link
              href="/search"
              className="mt-4 inline-flex items-center text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              Browse all brokers
            </Link>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-10">
          <FAQSection items={faqItems} />
        </div>

        {/* SEO content */}
        <section className="mt-16 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-[#0f2a4a]">
            About Mortgage Brokers in {city.name}
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-600">
            <p>
              Looking for a mortgage broker in {city.name}, {city.province}?
              Our directory connects you with experienced mortgage professionals
              who can help you find the best rates and terms for your unique
              financial situation.
            </p>
            <p>
              Whether you are a first-time homebuyer, looking to refinance, or
              investing in property, {city.name}&apos;s mortgage brokers offer
              personalized guidance to navigate the lending process. Compare
              ratings, read reviews, and contact brokers directly through our
              platform.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
