import { createServiceRoleClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/constants";
import { COUNTRY, PROVINCE_WHITELIST } from "@/lib/country";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const supabase = await createServiceRoleClient();

  const [
    { data: listings },
    { data: regions },
    { data: specializations },
  ] = await Promise.all([
    supabase
      .from("mortgage_listings")
      .select("slug, updated_at")
      .eq("is_active", true)
      .eq("country", COUNTRY),
    supabase.from("mortgage_regions").select("slug").in("province", PROVINCE_WHITELIST[COUNTRY]),
    supabase.from("mortgage_specializations").select("slug"),
  ]);

  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/search</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

  if (regions) {
    for (const region of regions) {
      xml += `
  <url>
    <loc>${SITE_URL}/${region.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

      if (specializations) {
        for (const spec of specializations) {
          xml += `
  <url>
    <loc>${SITE_URL}/${region.slug}/${spec.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
        }
      }
    }
  }

  if (listings) {
    for (const listing of listings) {
      xml += `
  <url>
    <loc>${SITE_URL}/listing/${listing.slug}</loc>
    <lastmod>${listing.updated_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    }
  }

  xml += `
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
