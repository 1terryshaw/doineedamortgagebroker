import { getUkPublishedCount, UK_DOMAIN } from "@/lib/uk-mortgage";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const CHUNK_SIZE = 45_000;

function ukBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${UK_DOMAIN}`
  ).replace(/\/$/, "");
}

// UK sitemap-index. Chunk 0 = static + county + town-hub URLs (no firms). Chunks 1..N =
// firm URLs, CHUNK_SIZE each, so no child can exceed the 50k protocol limit. Scoped to
// the published /uk universe only.
export async function GET() {
  const baseUrl = ukBaseUrl();

  const firmCount = await getUkPublishedCount();
  const totalChunks = 1 + Math.ceil(firmCount / CHUNK_SIZE);
  const lastmod = new Date().toISOString();

  const sitemaps = Array.from(
    { length: totalChunks },
    (_, i) =>
      `  <sitemap><loc>${baseUrl}/uk/sitemap/${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
