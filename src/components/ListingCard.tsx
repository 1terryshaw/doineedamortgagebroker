import Link from "next/link";
import type { Listing } from "@/types";

interface ListingCardProps {
  listing: Listing;
  // Owner-uploaded media (from listing_photos), batched by the parent list page.
  ownerHeroUrl?: string | null;
  ownerLogoUrl?: string | null;
}

function StarRating({ rating }: { rating: number | null }) {
  const value = rating ?? 0;
  const fullStars = Math.floor(value);
  const hasHalf = value - fullStars >= 0.25 && value - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <svg key={`full-${i}`} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {hasHalf && (
        <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="halfGrad">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="#D1D5DB" />
            </linearGradient>
          </defs>
          <path fill="url(#halfGrad)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <svg key={`empty-${i}`} className="h-4 w-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function ListingCard({
  listing,
  ownerHeroUrl,
  ownerLogoUrl,
}: ListingCardProps) {
  // Render precedence (TDL Boost port, Phase F):
  //   card image: hero_image_url -> owner photo #0 (listing_photos) -> photo_url
  //   logo:       owner logo (listing_photos) -> photo_url
  const cardImage =
    listing.hero_image_url || ownerHeroUrl || listing.photo_url || undefined;
  const cardLogo = ownerLogoUrl || listing.photo_url || undefined;
  const specializations =
    listing.specializations ??
    listing.mortgage_listing_specializations?.map((ls) => ls.mortgage_specializations) ??
    [];

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="group block rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-teal-300"
    >
      {/* Cover image */}
      <div className="relative h-36 w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-[#0f2a4a] to-teal-700">
        {cardImage ? (
          <img
            src={cardImage}
            alt={listing.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-12 w-12 text-teal-300/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
        )}
        {listing.is_premium && (
          <span className="absolute right-2 top-2 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-semibold text-[#0f2a4a]">
            Premium
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Logo + Name */}
        <div className="flex items-start gap-3">
          {cardLogo ? (
            <img
              src={cardLogo}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full border border-gray-200 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f2a4a] text-sm font-bold text-white">
              {listing.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[#0f2a4a] group-hover:text-teal-700">
              {listing.name}
            </h3>
            {listing.city && (
              <p className="text-sm text-gray-500">
                {listing.city}, {listing.province}
              </p>
            )}
          </div>
        </div>

        {/* Rating */}
        <div className="mt-3 flex items-center gap-2">
          <StarRating rating={listing.google_rating} />
          <span className="text-sm font-medium text-[#0f2a4a]">
            {listing.google_rating?.toFixed(1) ?? "N/A"}
          </span>
          <span className="text-sm text-gray-400">
            ({listing.google_review_count} {listing.google_review_count === 1 ? "review" : "reviews"})
          </span>
        </div>

        {/* Specialization badges */}
        {specializations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {specializations.slice(0, 4).map((spec) => (
              <span
                key={spec.id}
                className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20"
              >
                {spec.name}
              </span>
            ))}
            {specializations.length > 4 && (
              <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-300">
                +{specializations.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
