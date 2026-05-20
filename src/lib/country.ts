const country = process.env.NEXT_PUBLIC_COUNTRY;

if (!country) {
  throw new Error(
    "NEXT_PUBLIC_COUNTRY is not set. This directory must declare its country scope explicitly. Set NEXT_PUBLIC_COUNTRY in the Vercel project environment."
  );
}

if (country !== "CA" && country !== "US") {
  throw new Error(
    `NEXT_PUBLIC_COUNTRY must be "CA" or "US", got "${country}".`
  );
}

export const COUNTRY: "CA" | "US" = country as "CA" | "US";

export const PROVINCE_WHITELIST: Record<"CA" | "US", string[]> = {
  CA: ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"],
  US: [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
    "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
    "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
    "WV", "WI", "WY",
  ],
};
