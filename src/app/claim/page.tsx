import { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

// v2run1b 2026-09-14: the header now links to /claim (both hosts of this repo —
// doineedamortgagebroker.com and findmymortgagebroker.ca — served /claim as a 404 and carried
// no claim affordance at all; Site Surfer v2 CLAIM-CTA ×2, /claim 404 ×2). The per-listing
// flow is unchanged: /claim/{slug} is the owner-token claim (TDL #624), reached from the
// listing page's own "Claim this listing" CTA. This landing page only routes the reader there.
export const metadata: Metadata = {
  title: "Claim Your Listing",
  description: `Find your brokerage in the ${SITE_NAME} directory and claim your listing to manage your page.`,
  alternates: { canonical: "/claim" },
};

export default function ClaimLandingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-4 text-3xl font-bold">Claim Your {SITE_NAME} Listing</h1>
      <p className="mb-8 text-gray-600">
        Find your brokerage in our directory and use the claim link on its listing page to verify
        ownership and manage your page.
      </p>
      <Link href="/directory" className="btn-primary">
        Browse the Directory
      </Link>
    </div>
  );
}
