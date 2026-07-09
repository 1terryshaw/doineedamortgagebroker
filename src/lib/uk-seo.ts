// src/lib/uk-seo.ts — JSON-LD + canonical/metadata helpers for the /uk subtree.
//
// Deliberately emits NO AggregateRating and NO Review nodes: the UK pilot delivers no
// reviews, and stamping rating schema would re-introduce the false-claim problem the
// empire reviews/pricing workstream removed. Addresses are GB; the single-firm @type is
// schema.org/FinancialService (a valid LocalBusiness subtype — the same type the US
// listing JSON-LD uses). UK relevance is content-driven (UK firms, GB addresses); no
// hreflang on these unique-per-geo pages. Nothing here imports jurisdiction.ts.
import type { Metadata } from "next";
import { UK_BRAND, UK_DOMAIN } from "@/lib/uk-mortgage";
import type { UkFirm } from "@/lib/uk-mortgage";

/** Canonical base for /uk. .com project env first; falls back to the .com host. */
export const UK_SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  `https://${UK_DOMAIN}`
).replace(/\/$/, "");

export function ukCanonicalPath(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${UK_SITE_URL}${clean}`;
}

/**
 * Page metadata for /uk routes: canonical (relative, resolved against metadataBase),
 * OG, and Twitter Card. locale en_GB signals the UK market via content, not hreflang.
 */
export function ukPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const url = ukCanonicalPath(opts.path);
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    ...(opts.index === false ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: UK_BRAND,
      type: "website",
      locale: "en_GB",
    },
    twitter: {
      card: "summary",
      title: opts.title,
      description: opts.description,
    },
  };
}

/** Home -> UK Mortgage Brokers -> ...crumbs. Each crumb is { name, path } (site-relative). */
export function ukBreadcrumbSchema(crumbs: Array<{ name: string; path: string }>) {
  const base = [
    { name: "Home", path: "/uk" },
    { name: "UK Mortgage Brokers", path: "/uk" },
  ];
  const all = [...base, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: ukCanonicalPath(c.path),
    })),
  };
}

export function ukCollectionPageSchema(
  name: string,
  path: string,
  firmCount: number,
  areaName: string
) {
  const noun = firmCount === 1 ? "mortgage broker" : "mortgage brokers";
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: ukCanonicalPath(path),
    description: `Browse ${firmCount} FCA-authorised ${noun} in ${areaName}, United Kingdom.`,
  };
}

/**
 * FinancialService schema for a single firm. Includes PostalAddress (GB), optional
 * ContactPoint (telephone), website, and the firm's geographic area. NO rating nodes.
 */
export function ukFirmSchema(firm: UkFirm) {
  const slug = firm.company_number ?? firm.id;
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    name: firm.business_name,
    url: ukCanonicalPath(`/uk/directory/${slug}`),
    address: {
      "@type": "PostalAddress",
      ...(firm.registered_address ? { streetAddress: firm.registered_address } : {}),
      ...(firm.town ? { addressLocality: firm.town } : {}),
      ...(firm.county ? { addressRegion: firm.county } : {}),
      ...(firm.postcode ? { postalCode: firm.postcode } : {}),
      addressCountry: "GB",
    },
  };
  if (firm.website) schema.sameAs = [firm.website];
  if (firm.phone) {
    schema.contactPoint = {
      "@type": "ContactPoint",
      telephone: firm.phone,
      contactType: "customer service",
      areaServed: "GB",
    };
    schema.telephone = firm.phone;
  }
  if (firm.town || firm.county) {
    schema.areaServed = {
      "@type": "City",
      name: firm.town || firm.county,
    };
  }
  schema.provider = {
    "@type": "Organization",
    name: UK_BRAND,
    url: UK_SITE_URL,
  };
  return schema;
}
