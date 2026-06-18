"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { canonical } from "@/lib/vertical-canonical";
import { useOwnerAuth } from "@/lib/useOwnerAuth";

interface Props {
  listingSlug: string;
  listingOwnerEmail?: string;
  children: ReactNode;
}

export default function ListingClaimCTAClient({
  listingSlug,
  listingOwnerEmail,
  children,
}: Props) {
  const { authenticated, slug, ownerEmail, loading } = useOwnerAuth();

  if (loading) return <>{children}</>;

  if (
    authenticated &&
    (slug === listingSlug || (ownerEmail && ownerEmail === listingOwnerEmail))
  ) {
    return (
      <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
        <p className="font-semibold text-green-800">This is your listing</p>
        <Link
          href={`/owner/${slug}/edit`}
          className="inline-block mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: canonical.primaryColor }}
        >
          Edit My Listing
        </Link>
      </div>
    );
  }

  if (authenticated) {
    return null;
  }

  return <>{children}</>;
}
