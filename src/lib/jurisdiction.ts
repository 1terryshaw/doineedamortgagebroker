// Country-conditional content layer (the "accuracy layer"), keyed on
// NEXT_PUBLIC_COUNTRY via COUNTRY. The US values reproduce the existing US copy
// byte-for-byte, so the live .com (COUNTRY=US) is unchanged; CA values are used
// once findmymortgagebroker.ca repoints to this survivor repo (Phase 2).
//
// RULE: never label CA brokers as state/NMLS-licensed. CA = provincial regulators.
import { COUNTRY } from "./country";

export interface Jurisdiction {
  country: "CA" | "US";
  countryName: string; // "the United States" / "Canada"
  directoryScope: string; // for meta: "a US directory" / "a Canadian directory"
  // Legal/About page copy
  regulatorRecords: string; // "official state regulator records" / "provincial regulator records"
  regulatorRecordsParen: string; // the parenthetical in About
  notAffiliated: string; // affiliation disclaimer subjects
  verifyRegistry: { name: string; url: string };
  verifyTrailer: string; // sentence after the verify link in About
  removalIdProof: string; // proof to request removal
  governingLaw: string; // governing-law jurisdiction
  privacyLawHeading: string;
  privacyLawIntro: string;
  privacyLawRights: string;
  // Homepage / shared-chrome copy
  heroSubcopy: string;
  heroSourcedLine: string;
  homeWebsiteDesc: string; // WebSite JSON-LD description
  homeOrgDesc: string; // Organization JSON-LD description
  searchPlaceholder: string;
  searchPageDescription: string;
  footerTagline: string;
  footerVerifyLine: string;
  disclaimerSourceLine: string; // tail of the site-wide Disclaimer banner
  browseHeading: string; // footer browse section heading
  popularPlaces: { href: string; label: string }[];
  // Accuracy constants (exposed for any jurisdiction-specific content)
  reverseMortgageMinAge: number; // US 62 / CA 55
  currencyCode: string; // USD / CAD
  locale: string; // en-US / en-CA (BCP-47)
  ogLocale: string; // en_US / en_CA
  // Layout meta
  siteTitleSuffix: string;
  siteDescription: string;
}

const JURISDICTIONS: Record<"CA" | "US", Jurisdiction> = {
  US: {
    country: "US",
    countryName: "the United States",
    directoryScope: "a US directory",
    regulatorRecords: "official state regulator records",
    regulatorRecordsParen:
      " (NMLS-linked state agencies that publish their licensee rosters publicly)",
    notAffiliated: "NMLS, CSBS, or any state regulator",
    verifyRegistry: {
      name: "NMLS Consumer Access",
      url: "https://www.nmlsconsumeraccess.org/",
    },
    verifyTrailer:
      "before engaging. License status changes — our snapshot reflects the most recent state regulator publication and may be out of date.",
    removalIdProof:
      "government-issued ID or current NMLS dashboard screenshot showing your NMLS ID",
    governingLaw: "the United States and the State of Florida",
    privacyLawHeading: "California Privacy Rights (CCPA / CPRA)",
    privacyLawIntro:
      "California residents have the right to: (a) know what personal information we collect, (b) request deletion of personal information, (c) opt out of any “sale” or “sharing” of personal information, and (d) be free from discrimination for exercising these rights.",
    privacyLawRights:
      "We do not sell personal information. To exercise any CCPA right, email",
    heroSubcopy:
      "Compare licensed loan originators and mortgage broker firms across the United States. Listings are sourced from official state regulator records.",
    heroSourcedLine: "Sourced from state regulator public records",
    homeWebsiteDesc: "Find a licensed mortgage broker in the United States",
    homeOrgDesc:
      "A US directory of licensed mortgage brokers and loan originators sourced from official state regulator records",
    searchPlaceholder: "Search by name, NMLS ID, or keyword...",
    searchPageDescription:
      "Search and compare licensed mortgage brokers and loan originators in the United States. Filter by city, specialization, and rating to find the right broker for your needs.",
    footerTagline:
      "A US directory of licensed mortgage brokers and loan originators. Compare professionals sourced from official state regulator records.",
    footerVerifyLine:
      "Listings reflect publicly available state regulator data. Inclusion does not imply endorsement. Always verify a broker’s license status on the NMLS Consumer Access portal before engaging.",
    disclaimerSourceLine:
      "are sourced from public state regulator records and may not reflect current license status.",
    browseHeading: "Popular Cities",
    popularPlaces: [
      { href: "/miami", label: "Miami, FL" },
      { href: "/orlando", label: "Orlando, FL" },
      { href: "/tampa", label: "Tampa, FL" },
      { href: "/jacksonville", label: "Jacksonville, FL" },
      { href: "/fort-lauderdale", label: "Fort Lauderdale, FL" },
    ],
    reverseMortgageMinAge: 62,
    currencyCode: "USD",
    locale: "en-US",
    ogLocale: "en_US",
    siteTitleSuffix: "Find a US Mortgage Broker",
    siteDescription:
      "Find a licensed mortgage broker or loan originator in the United States. Compare licensed professionals sourced from official state regulator records. This is a directory, not financial advice.",
  },
  CA: {
    country: "CA",
    countryName: "Canada",
    directoryScope: "a Canadian directory",
    regulatorRecords: "provincial regulator records",
    regulatorRecordsParen:
      " (provincial mortgage regulators such as FSRA, BCFSA, and others that publish their licensee rosters publicly)",
    notAffiliated: "FSRA, BCFSA, or any provincial regulator",
    verifyRegistry: {
      name: "your provincial mortgage regulator (e.g. FSRA in Ontario, BCFSA in BC)",
      url: "https://www.fsrao.ca/consumers/mortgage-brokering",
    },
    verifyTrailer:
      "before engaging. Licence status changes — our snapshot reflects the most recent provincial regulator publication and may be out of date.",
    removalIdProof:
      "government-issued ID or proof of your current provincial mortgage broker licence",
    governingLaw: "the Province of Ontario, Canada",
    privacyLawHeading: "Canadian Privacy Rights (PIPEDA)",
    privacyLawIntro:
      "Under Canada’s Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy laws, you have the right to: (a) know what personal information we hold about you, (b) request access to and correction of that information, (c) request deletion of personal information, and (d) withdraw consent to its use.",
    privacyLawRights:
      "We do not sell personal information. To exercise any privacy right, email",
    heroSubcopy:
      "Compare licensed mortgage brokers across Canada. Listings are sourced from provincial regulator records (FSRA, BCFSA, and other provincial regulators).",
    heroSourcedLine: "Sourced from provincial regulator public records",
    homeWebsiteDesc: "Find a licensed mortgage broker in Canada",
    homeOrgDesc:
      "A Canadian directory of licensed mortgage brokers sourced from provincial regulator records",
    searchPlaceholder: "Search by name, licence #, or keyword...",
    searchPageDescription:
      "Search and compare licensed mortgage brokers in Canada. Filter by city, specialization, and rating to find the right broker for your needs.",
    footerTagline:
      "A Canadian directory of licensed mortgage brokers. Compare professionals sourced from provincial regulator records (FSRA, BCFSA, and others).",
    footerVerifyLine:
      "Listings reflect publicly available provincial regulator data. Inclusion does not imply endorsement. Always verify a broker’s licence status with the relevant provincial regulator (FSRA, BCFSA, etc.) before engaging.",
    disclaimerSourceLine:
      "are sourced from public provincial regulator records and may not reflect current licence status.",
    browseHeading: "Browse by Province",
    popularPlaces: [
      { href: "/search?province=ON", label: "Ontario" },
      { href: "/search?province=BC", label: "British Columbia" },
      { href: "/search?province=QC", label: "Quebec" },
      { href: "/search?province=AB", label: "Alberta" },
      { href: "/search?province=NS", label: "Nova Scotia" },
    ],
    reverseMortgageMinAge: 55,
    currencyCode: "CAD",
    locale: "en-CA",
    ogLocale: "en_CA",
    siteTitleSuffix: "Find a Mortgage Broker in Canada",
    siteDescription:
      "Find a licensed mortgage broker in Canada. Compare professionals sourced from provincial regulator records (FSRA, BCFSA, and other provincial regulators). This is a directory, not financial advice.",
  },
};

export const JURISDICTION: Jurisdiction = JURISDICTIONS[COUNTRY];

// Cross-host hreflang alternates (additive). Both hosts are known; per-page
// reciprocity completes once .ca repoints to this survivor repo (Phase 2).
export const HREFLANG_ALTERNATES: Record<string, string> = {
  "en-US": "https://doineedamortgagebroker.com",
  "en-CA": "https://findmymortgagebroker.ca",
};
