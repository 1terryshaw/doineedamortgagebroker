import { SITE_URL } from "@/lib/constants";
import { renderIndex } from "@/lib/sitemap-chunks";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

// /sitemap.xml is now a <sitemapindex> (TDL #957) — the flat urlset exceeded the
// sitemap.org 50k ceiling (93,662 URLs). Children live at /sitemap/{i}.xml.
export async function GET() {
  const xml = await renderIndex(SITE_URL);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
