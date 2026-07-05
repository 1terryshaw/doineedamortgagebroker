const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://doineedamortgagebroker.com";

interface WebSiteJsonLdProps {
  name: string;
  url: string;
  description: string;
}

export function WebSiteJsonLd({ name, url, description }: WebSiteJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface OrganizationJsonLdProps {
  name: string;
  url: string;
  description: string;
}

export function OrganizationJsonLd({
  name,
  url,
  description,
}: OrganizationJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    description,
    logo: `${BASE_URL}/favicon.png`,
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface LocalBusinessJsonLdProps {
  name: string;
  description?: string;
  url: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  images?: string[];
  // Additive AI-enrichment signals (optional; gap-fill only, never override authoritative data).
  knowsAbout?: string[];
  availableLanguage?: string[];
  areaServed?: string[];
}

export function LocalBusinessJsonLd({
  name,
  description,
  url,
  phone,
  address,
  city,
  province,
  latitude,
  longitude,
  rating,
  reviewCount,
  images,
  knowsAbout,
  availableLanguage,
  areaServed,
}: LocalBusinessJsonLdProps) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    name,
    url,
  };

  if (description) data.description = description;
  if (phone) data.telephone = phone;

  if (address || city || province) {
    data.address = {
      "@type": "PostalAddress",
      ...(address && { streetAddress: address }),
      ...(city && { addressLocality: city }),
      ...(province && { addressRegion: province }),
      addressCountry: "CA",
    };
  }

  if (latitude && longitude) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude,
      longitude,
    };
  }

  if (rating && reviewCount) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (images && images.length > 0) {
    data.image = images;
  }

  if (knowsAbout && knowsAbout.length > 0) {
    data.knowsAbout = knowsAbout;
  }

  if (availableLanguage && availableLanguage.length > 0) {
    data.availableLanguage = availableLanguage;
  }

  if (areaServed && areaServed.length > 0) {
    data.areaServed = areaServed.map((c) => ({ "@type": "City", name: c }));
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface ItemListItem {
  name: string;
  url: string;
  position: number;
}

interface ItemListJsonLdProps {
  items: ItemListItem[];
  listName: string;
}

export function ItemListJsonLd({ items, listName }: ItemListJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      name: item.name,
      url: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQPageJsonLdProps {
  items: FAQItem[];
}

export function FAQPageJsonLd({ items }: FAQPageJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
