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

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Owner Dashboard",
};

export default async function OwnerPortalPage({ params }: Props) {
  const { slug } = await params;
  const result = await verifyOwnerAccess(slug);

  if (!result) {
    redirect("/owner/login");
  }

  const listing = result.listing as { id: string; name: string; slug: string };
  const { photos } = await listPhotosForListing(result.listing.id);
  const health = computeListingHealth(result.listing, photos.length);

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
        <h2 className="text-lg font-semibold text-[#1B2A4A] mb-3">Inquiries</h2>
        <OwnerLeads listingId={listing.id} initialLeads={leads ?? []} />
      </div>
    </div>
  );
}
