import { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";
import ClaimForm from "@/components/ClaimForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ slug: string }>;
  // A claim arriving from a lead-pitch carries ?src=lead&lid=<leadId> (TDL #472).
  searchParams: Promise<{ src?: string; lid?: string }>;
}

export const metadata: Metadata = {
  title: "Claim Listing",
  robots: { index: false, follow: false },
};

export default async function ClaimPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { src, lid } = await searchParams;

  const { data: listing } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("slug, name, is_claimed")
    .eq("slug", slug)
    .single();

  if (!listing) notFound();

  if (listing.is_claimed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Listing Already Claimed</h1>
        <p className="text-gray-600">This listing has already been claimed by its owner.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <ClaimForm
        listingSlug={listing.slug}
        listingName={listing.name}
        src={src}
        lid={lid}
      />
    </div>
  );
}
