import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SITE_NAME } from "@/lib/constants";
import { COUNTRY } from "@/lib/country";
import type { Region, Listing, Specialization } from "@/types";
import ListingCard from "@/components/ListingCard";
import { getCardMediaForListings } from "@/lib/listing-photos";

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

// Anon reads on mortgage_listings MUST project explicit columns — `select("*")`
// fails with 42501 "permission denied for table mortgage_listings" (anon has
// column-level SELECT on only 96 of 100 columns; anon-lockdown 012/013). Same
// projection as the /listing/[slug] fix (TDL #1203, 51f808a). NOTE: this list
// route also depends on mortgage_listing_specializations having rows — that
// table is currently empty, so these pages render empty regardless of this fix
// (a data gap, not the query bug); the projection removes the latent 42501 for
// when spec links exist.
const SPEC_LISTING_SELECT = `
  id, name, slug, license_number, email, phone, website, address, city, province,
  postal_code, latitude, longitude, region_id, city_slug, bio, photo_url, languages,
  years_experience, google_rating, google_review_count, is_claimed, is_premium,
  is_active, claimed_by, google_place_id, source, created_at, updated_at, owner_email,
  short_description, claimed, siteforge_preview_url, siteforge_generation_id,
  outreach_email4_at, now_hiring, subscription_tier, listing_type, claimed_at,
  claim_verified, outreach_unsubscribed, featured, outreach_email1_at,
  outreach_email2_at, outreach_email3_at, outreach_email1_variant, outreach_bounced,
  last_verified_at, verification_status, verification_notes, cached_rating,
  cached_review_count, cached_reviews, cached_photos, cached_hours,
  google_data_cached_at, refresh_cadence_tier, country, email_harvest_attempted,
  email_harvested_at, email_invalid, tier, enrichment_attempted, enrichment_at,
  owner_last_action_at, enrichment_source, enriched_at, trade_category,
  outreach_email1_synthetic, state_province, hero_image_url, trial_end,
  province_state, audience_quality, pending_description, last_claim_pitch_at, lei,
  hmda_orig_count, hmda_year, services, service_area, gbp_url, hours_json, owner_name,
  is_published, nmls_id, source_grain, sponsor_nmls_id, sponsor_name, state_license_id,
  rssd_id, outreach_email1_uncounted_send, deserve_candidate, deserve_reason,
  deserved_at, invite_sent_at,
  mortgage_listing_specializations(
    specialization_id,
    mortgage_specializations(*)
  )
`;

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
    .select(SPEC_LISTING_SELECT)
    .in("id", listingIds)
    .eq("region_id", regionId)
    .eq("is_active", true)
    .eq("country", COUNTRY)
    .order("is_premium", { ascending: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .limit(60);

  return (data as unknown as Listing[] | null) ?? [];
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

  // Batched owner media for the cards (one query, no per-card waterfall).
  const cardMedia = await getCardMediaForListings(listings.map((l) => l.id));

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
