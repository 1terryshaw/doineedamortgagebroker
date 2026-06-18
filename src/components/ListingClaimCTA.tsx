import Link from "next/link";
import { canonical } from "@/lib/vertical-canonical";
import ListingClaimCTAClient from "./ListingClaimCTAClient";

interface Props {
  listingSlug: string;
  listingClaimed: boolean;
  listingOwnerEmail?: string;
  variant?: "default" | "prominent";
}

export default function ListingClaimCTA({
  listingSlug,
  listingClaimed,
  listingOwnerEmail,
  variant = "default",
}: Props) {
  const claimCardClass =
    variant === "prominent"
      ? "mt-8 bg-gray-50 border border-l-4 rounded-lg p-6"
      : "mt-8 bg-gray-50 border rounded-lg p-6";
  const claimCardStyle =
    variant === "prominent"
      ? { borderLeftColor: canonical.primaryColor }
      : undefined;

  const anonymousView = listingClaimed ? (
    <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6 flex items-center gap-3">
      <span className="text-green-600 text-xl">&#10003;</span>
      <div>
        <p className="font-semibold text-green-800">Verified Business</p>
        <p className="text-sm text-green-700">
          This listing has been claimed and verified by the business owner.
        </p>
      </div>
    </div>
  ) : (
    <div className={claimCardClass} style={claimCardStyle}>
      <p className="font-semibold">Is this your business?</p>
      <p className="text-sm text-gray-600 mt-1">
        Claim this listing to manage it and connect with customers.
      </p>
      <Link
        href={`/claim/${listingSlug}`}
        className="inline-block mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium"
        style={{ backgroundColor: canonical.primaryColor }}
      >
        Claim Listing
      </Link>
    </div>
  );

  return (
    <ListingClaimCTAClient
      listingSlug={listingSlug}
      listingOwnerEmail={listingOwnerEmail}
    >
      {anonymousView}
    </ListingClaimCTAClient>
  );
}
