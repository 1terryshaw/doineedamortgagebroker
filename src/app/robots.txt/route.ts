import { SITE_URL } from "@/lib/constants";

export function GET() {
  // base + UK sitemaps. /uk/sitemap.xml is itself a <sitemapindex>, and the
  // protocol forbids an index listing another index — so the UK tree is declared
  // as a second top-level sitemap rather than nested inside /sitemap.xml.
  // Same shape as doineedatutor (#1105).
  const body = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/uk/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
