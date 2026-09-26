import { redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { verifyOwnerAccess } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { listPhotosForListing } from "@/lib/listing-photos";
import { computeListingHealth } from "@/lib/listing-health";
import { canonical } from "@/lib/vertical-canonical";
import ListingStrengthCard from "@/components/ListingStrengthCard";
import OwnerLogoutButton from "@/components/OwnerLogoutButton";
import OwnerLeads from "@/components/OwnerLeads";
import GbpConnectCard from "@/components/GbpConnectCard";
import NextStepCard from "@/components/NextStepCard";
import SavedNotice from "@/components/SavedNotice";
import { deriveNextStep } from "@/lib/owner-next-step";
import { addressEditClass, addressEditAllowed } from "@/lib/owner-location-edit";
import ReviewKit from "@/components/ReviewKit";
import { buildReviewKit, reviewKitPlaceId } from "@/lib/review-kit";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Owner Dashboard",
};

export default async function OwnerPortalPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const saved = (await searchParams).saved === "1"; // owner-journey-friction-fix-v1
  const result = await verifyOwnerAccess(slug);

  if (!result) {
    redirect("/owner/login");
  }

  const listing = result.listing as { id: string; name: string; slug: string };
  const { photos } = await listPhotosForListing(result.listing.id);
  const health = computeListingHealth(result.listing, photos.length);

  // owner-next-step-card-canary-v1: one action, derived read-only from this row.
  const row = result.listing as Record<string, unknown>;
  // owner-canary-fixes-and-review-kit-v1: the review kit, for a Google-connected (ChIJ) row only.
  const kitPlaceId = reviewKitPlaceId(row.google_place_id as string | null);
  const reviewKit = kitPlaceId ? buildReviewKit(kitPlaceId) : null;
  const nextStep = deriveNextStep(
    {
      slug: listing.slug,
      phone: row.phone as string | null,
      website: row.website as string | null,
      hours_json: row.hours_json,
      // mortgage_listings has no `description` column: the editor's "Full Description" is stored in `bio`
      // (app/api/owner/update, TDL #604).
      description: row.bio as string | null,
      address: row.address as string | null,
      show_address: row.show_address as boolean | null,
      google_place_id: row.google_place_id as string | null,
      google_review_count: row.google_review_count as number | null,
    },
    photos.length,
    {
      addressEditable: addressEditAllowed(await addressEditClass(row.source as string | null)),
      photosSupported: true,
      reviewKit: !!reviewKit,
    },
  );

  // Owner leads (replaces the deprecated /dashboard inquiries view, TDL #607).
  const { data: leads } = await supabaseAdmin
    .from("mortgage_inquiries")
    .select("id, sender_name, sender_email, message, created_at")
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500">Your listing</p>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">{listing.name}</h1>
        </div>
        <OwnerLogoutButton />
      </div>

      {/* owner-next-step-card-canary-v1: the one next action, directly under the header. */}
      <div className="space-y-6 mb-6">
        {saved && <SavedNotice />}
            <NextStepCard step={nextStep} />
        {reviewKit && <ReviewKit kit={reviewKit} slug={listing.slug} />}
      </div>

      <ListingStrengthCard
        health={health}
        primaryColor={canonical.primaryColor}
        editHref={`/owner/${listing.slug}/edit`}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/owner/${listing.slug}/edit`}
          className="inline-block px-6 py-3 rounded-lg text-white font-medium"
          style={{ backgroundColor: canonical.primaryColor }}
        >
          Edit your listing
        </Link>
        <Link
          href={`/listing/${listing.slug}`}
          className="inline-block px-6 py-3 rounded-lg border font-medium hover:bg-gray-50"
        >
          View public listing
        </Link>
      </div>

      <div className="mt-10">
        <GbpConnectCard
          slug={listing.slug}
          listingId={String((listing as { id?: string }).id ?? "")}
          googlePlaceId={(listing as { google_place_id?: string | null }).google_place_id ?? null}
          gbpUrlOnFile={(listing as { gbp_url?: string | null }).gbp_url ?? null}
          googleRating={(listing as { google_rating?: number | null }).google_rating ?? null} // owner-journey-friction-fix-v1 B
          primaryColor={canonical.primaryColor}
        />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-[#1B2A4A] mb-3">Inquiries</h2>
        <OwnerLeads listingId={listing.id} initialLeads={leads ?? []} />
      </div>
    </div>
  );
}
