import { redirect } from "next/navigation";
import { Metadata } from "next";
import { verifyOwnerAccess } from "@/lib/auth";
import { listPhotosForListing } from "@/lib/listing-photos";
import OwnerEditForm from "@/components/OwnerEditForm";

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

  // Mortgage's OwnerEditForm reads name/province/bio from the listing directly
  // (no initialName/initialProvince props, unlike canonical). onSaved/onCancel
  // omitted → the form redirects back to /owner/{slug} standalone.
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <OwnerEditForm
        listing={result.listing}
        initialPhotos={photos}
        initialLogo={logo}
      />
    </div>
  );
}
