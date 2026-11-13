import { SITE_URL } from "@/lib/constants";
import { renderIndex } from "@/lib/sitemap-chunks";

// ISR: sized from getSegments/count only — no decorative lastmod corpus scan.
// A generation fault rethrows (K189/K216: never an empty 200, never a 503 that
// replaces a good sitemap). At BUILD, soft-fail to a non-empty index pointing at
// chunk 0 only so `next build` stays green without a live heavy query (stream53).
export const dynamic = "force-static";
export const revalidate = 86400;
export const maxDuration = 60;

async function renderSitemapIndex(): Promise<Response> {
  try {
    const xml = await renderIndex(SITE_URL);
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (e) {
    console.error(
      "sitemap index: getSegments failed; build soft-fail to chunk-0-only index (no fabricated lastmod)",
      e,
    );
    // Build without a live DB must not fail the deployment. Runtime keeps
    // fail-closed so ISR retains the last good index (K189/K216 — never empty 200).
    if (process.env.NEXT_PHASE === "phase-production-build") {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE_URL}/sitemap/0.xml</loc></sitemap>
</sitemapindex>`;
      return new Response(xml, {
        headers: { "Content-Type": "application/xml" },
      });
    }
    throw e;
  }
}

export async function GET(): Promise<Response> {
  try {
    return await renderSitemapIndex();
  } catch (err) {
    console.error(
      "[sitemap] generation FAULT — rethrowing (K189/K216: no 503 fallback, never an empty 200):",
      err,
    );
    throw err;
  }
}
