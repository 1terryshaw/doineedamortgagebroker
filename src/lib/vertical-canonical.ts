// Mortgage-specific canonical surface for the ported OwnerEditForm v1 stamp.
// The canonical (doineedanaccountant) derives this from a generic
// lib/vertical.config adapter; mortgage is a single vertical, so the values are
// declared directly here — no vertical.config indirection needed.
export const canonical = {
  // Singular/plural nouns used in meta/headers/form copy.
  noun: "mortgage broker",
  nounPlural: "mortgage brokers",
  // Brand colour (mortgage navy — matches the listing/detail theme).
  primaryColor: "#1B2A4A",
  // Support email surfaced in error states.
  supportEmail: "support@doineedamortgagebroker.com",
  // Public domain — jurisdiction-keyed at runtime, left blank here.
  domain: "",
  // Underlying *_listings table prefix.
  tablePrefix: "mortgage_",
} as const;

// "mortgage" — bucket key in listing_photos rows + storage object path
// namespace ({VERTICAL_KEY}/{listingId}/{kind}/{uuid}.webp).
export const VERTICAL_KEY = canonical.tablePrefix.replace(/_$/, "");
