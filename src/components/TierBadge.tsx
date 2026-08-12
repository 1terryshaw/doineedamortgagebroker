import { can, getEffectiveTier } from "@/lib/tier-capabilities";

// Tier badge for the listing detail page.
//
// WHY THIS EXISTS: this repo's detail page rendered NO tier badge at all, so a paying
// listing was indistinguishable from a seeded one — worse than a free claimed listing on
// every other vertical. mortgage_listings is 71K rows with 0 paid claims today, so this
// lands before the first sale rather than after it.
//
// Mirrors the fleet's components/TierBadge.tsx shape deliberately:
//   • resolve via getEffectiveTier (subscription_tier wins unless "free"), NEVER
//     `tier ?? subscription_tier` — that reading prefers the operational column and
//     downgrades a paying listing whose `tier` still holds a non-paid value.
//   • gate on can(effectiveTier, "featured") with a CATCH-ALL return, so a paid tier can
//     never fall through to "no badge". An equality chain over tier names is the shape
//     that produced the original getapro-v2 bug.
//
// Adapted for this repo: no vertical.config here, so colours are Tailwind classes rather
// than an inline verticalConfig.primaryColor style.

const BASE = "text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap";

const REVIEWS_VERIFIED_TOOLTIP =
  "Reviews verified: this listing's Google rating and review count are shown here. It does not mean we independently checked or endorsed the business.";
const CLAIMED_TOOLTIP = "Claimed: the business owner confirmed this listing by email.";

interface TierBadgeProps {
  tier?: string | null;
  subscription_tier?: string | null;
  is_claimed?: boolean | null;
  google_rating?: number | string | null;
}

export default function TierBadge({
  tier,
  subscription_tier,
  is_claimed,
  google_rating,
}: TierBadgeProps) {
  const effectiveTier = getEffectiveTier({ tier, subscription_tier });

  if (can(effectiveTier, "featured")) {
    if (effectiveTier === "growth") {
      return <span className={`${BASE} bg-purple-600 text-white`}>Growth</span>;
    }
    if (effectiveTier === "website") {
      return <span className={`${BASE} bg-amber-500 text-white`}>Website</span>;
    }
    // Catch-all: any other tier granting "featured" (reviews_plus today).
    return <span className={`${BASE} bg-[#1B2A4A] text-white`}>Featured</span>;
  }

  if (is_claimed) {
    // "Reviews verified" only when the rating actually renders on the page.
    if (Number(google_rating) > 0) {
      return (
        <span className={`${BASE} bg-green-100 text-green-800`} title={REVIEWS_VERIFIED_TOOLTIP}>
          ✓ Reviews verified
        </span>
      );
    }
    return (
      <span className={`${BASE} bg-gray-100 text-gray-700`} title={CLAIMED_TOOLTIP}>
        Claimed
      </span>
    );
  }

  return null;
}
