import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SITE_NAME } from "@/lib/constants";
import type { Region, Listing, Specialization } from "@/types";
import ListingCard from "@/components/ListingCard";

interface PageProps {
  params: Promise<{ citySlug: string; professionSlug: string }>;
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

async function getSpecialization(slug: string): Promise<Specialization | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("mortgage_specializations")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as Specialization;
}

async function getListingsBySpecAndCity(
  regionId: string,
  specId: string
): Promise<Listing[]> {
  const supabase = await createServerSupabaseClient();

  // Get listing IDs that have this specialization
  const { data: specListings } = await supabase
    .from("mortgage_listing_specializations")
    .select("listing_id")
    .eq("specialization_id", specId);

  const listingIds = (specListings ?? []).map((s) => s.listing_id);

  if (listingIds.length === 0) return [];

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
    .in("id", listingIds)
    .eq("region_id", regionId)
    .eq("is_active", true)
    .eq("country", "US")
    .order("is_premium", { ascending: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .limit(60);

  return (data as Listing[] | null) ?? [];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { citySlug, professionSlug } = await params;

  const [city, specialization] = await Promise.all([
    getCity(citySlug),
    getSpecialization(professionSlug),
  ]);

  if (!city || !specialization) {
    return { title: "Not Found" };
  }

  const title = `${specialization.name} Mortgage Brokers in ${city.name}`;
  const description = `Find ${specialization.name.toLowerCase()} mortgage brokers in ${city.name}, ${city.province}. Compare ratings, read reviews, and get connected with specialized professionals.`;

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

export default async function CitySpecializationPage({ params }: PageProps) {
  const { citySlug, professionSlug } = await params;

  const [city, specialization] = await Promise.all([
    getCity(citySlug),
    getSpecialization(professionSlug),
  ]);

  if (!city || !specialization) {
    notFound();
  }

  const listings = await getListingsBySpecAndCity(city.id, specialization.id);

  return (
    <div className="min-h-screen bg-gray-50">
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
            <ol className="flex flex-wrap items-center gap-2 text-sm text-navy-300">
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
              <li>
                <Link
                  href={`/${city.slug}`}
                  className="hover:text-white transition-colors"
                >
                  {city.name}
                </Link>
              </li>
              <li>/</li>
              <li className="text-white font-medium">{specialization.name}</li>
            </ol>
          </nav>

          <div className="flex items-center gap-3 mb-4">
            {specialization.icon && (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">
                {specialization.icon}
              </span>
            )}
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {specialization.name} Mortgage Brokers in{" "}
              <span className="text-teal-400">{city.name}</span>
            </h1>
          </div>

          <p className="max-w-2xl text-base text-navy-300 sm:text-lg">
            {specialization.description
              ? specialization.description
              : `Find experienced ${specialization.name.toLowerCase()} mortgage brokers in ${city.name}, ${city.province}. Compare ratings and reviews to choose the right professional.`}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${city.slug}`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
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
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
              All Brokers in {city.name}
            </Link>
            <span className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white">
              {listings.length} broker{listings.length !== 1 ? "s" : ""} found
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Listings grid */}
        {listings.length > 0 ? (
          <section>
            <h2 className="text-xl font-bold text-[#0f2a4a] sm:text-2xl">
              Top {specialization.name} Brokers in {city.name}
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
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
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-[#0f2a4a]">
              No {specialization.name.toLowerCase()} brokers found in{" "}
              {city.name}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Try browsing all brokers in {city.name} or search in other cities.
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <Link
                href={`/${city.slug}`}
                className="text-sm font-medium text-teal-600 hover:text-teal-700"
              >
                All {city.name} Brokers
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href={`/search?specialization=${specialization.slug}`}
                className="text-sm font-medium text-teal-600 hover:text-teal-700"
              >
                {specialization.name} in Other Cities
              </Link>
            </div>
          </div>
        )}

        {/* SEO content */}
        <section className="mt-16 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-[#0f2a4a]">
            {specialization.name} Mortgage Brokers in {city.name}
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-600">
            <p>
              Looking for a mortgage broker in {city.name} who specializes in{" "}
              {specialization.name.toLowerCase()}? Our directory features
              experienced professionals in {city.name}, {city.province} who can
              guide you through the mortgage process with expertise in{" "}
              {specialization.name.toLowerCase()} lending.
            </p>
            <p>
              Compare ratings, read reviews from past clients, and find the
              broker that best matches your needs. Each broker profile includes
              contact information, specializations, and Google reviews to help
              you make an informed decision.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
