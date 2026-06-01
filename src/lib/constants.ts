export const SITE_NAME = "DoINeedAMortgageBroker";
export const SITE_DESCRIPTION =
  "Find a licensed mortgage broker in the United States. Compare licensed loan originators and broker firms across all 50 states. This is a directory, not financial advice.";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://doineedamortgagebroker.com";

export const ITEMS_PER_PAGE = 20;

export const SORT_OPTIONS = [
  { value: "rating", label: "Highest Rated" },
  { value: "reviews", label: "Most Reviews" },
  { value: "name", label: "Name (A-Z)" },
  { value: "newest", label: "Newest" },
] as const;

export const MORTGAGE_TYPES = [
  "Residential",
  "Commercial",
  "Refinancing",
  "First-Time Buyer",
  "Self-Employed",
  "Investment Property",
  "FHA Loan",
  "VA Loan",
  "USDA Loan",
  "Jumbo Loan",
  "Reverse Mortgage",
  "Construction",
  "Other",
] as const;

export const EMPLOYMENT_TYPES = [
  "Employed (W-2)",
  "Self-Employed",
  "1099 Contractor",
  "Retired",
  "Other",
] as const;

// TDL #455 Wave 3 — "hide": render the claim CTA (not the inquiry form) when a listing
// has no deliverable email. "capture" would keep the form with honest microcopy.
export const INQUIRY_NO_EMAIL_POLICY: "hide" | "capture" = "hide";
