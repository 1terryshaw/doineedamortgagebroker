import { redirect } from "next/navigation";
import { Metadata } from "next";
import { verifyOwnerAccess } from "@/lib/auth";
import { listPhotosForListing } from "@/lib/listing-photos";
import OwnerEditForm from "@/components/OwnerEditForm";
import { addressEditClass, addressEditAllowed } from "@/lib/owner-location-edit";
import { getOwnerGbpStatus } from "@/lib/owner-gbp-status";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Edit Listing",
};

export default async function OwnerEditPage({ params }: Props) {
  const { slug } = await params;
  const result = await verifyOwnerAccess(slug);

  if (!result) {
    redirect("/owner/login");
  }

  const { photos, logo } = await listPhotosForListing(result.listing.id);

  // claimant-edit-ux-stamp-v1: R2 street/postal gate (source class) + R1 GBP status (read-only).
  const lst = result.listing as unknown as Record<string, unknown>;
  const addressEditable = addressEditAllowed(await addressEditClass(lst.source as string | null));
  const gbpStatus = await getOwnerGbpStatus({
    id: result.listing.id as string,
    google_place_id: lst.google_place_id as string | null,
    gbp_url: lst.gbp_url as string | null,
  });

  // Mortgage's OwnerEditForm reads name/province/bio from the listing directly
  // (no initialName/initialProvince props, unlike canonical). onSaved/onCancel
  // omitted → the form redirects back to /owner/{slug} standalone.
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <OwnerEditForm
        listing={result.listing}
        initialPhotos={photos}
        initialLogo={logo}
        addressEditable={addressEditable}
        gbpStatus={gbpStatus}
        gbpConnectHref={null}
      />
    </div>
  );
}
