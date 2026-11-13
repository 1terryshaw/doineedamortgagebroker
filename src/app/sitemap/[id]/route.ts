import { renderChunk, getSegments } from "@/lib/sitemap-chunks";

// ISR + on-demand children. generateStaticParams returns [] so `next build` never
// prerenders /sitemap/{i}.xml against a live heavy listing keyset walk (stream53
// 57014 / Nov 9 therapist dpl ERROR). dynamicParams keeps unknown ids renderable
// on first request; a fault still rethrows (K189/K216 — no 503, never empty 200).
export const dynamic = "force-static";
export const revalidate = 86400;
export const maxDuration = 60;
export const dynamicParams = true;

/**
 * Never enumerate children against getSegments / getListingsContentRange at build.
 */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

async function renderSitemap(
  _req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await Promise.resolve(params);
  const match = /^(\d+)\.xml$/.exec(resolved.id);
  if (!match) {
    return new Response("Not Found", { status: 404 });
  }
  const id = Number(match[1]);
  const { totalChunks } = await getSegments();
  if (id >= totalChunks) {
    return new Response("Not Found", { status: 404 });
  }

  const xml = await renderChunk(id);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      // No explicit Cache-Control: with revalidate=86400 Next emits s-maxage itself.
    },
  });
}

export async function GET(
  ...args: Parameters<typeof renderSitemap>
): Promise<Response> {
  try {
    return await renderSitemap(...args);
  } catch (err) {
    console.error(
      "[sitemap] generation FAULT — rethrowing (K189/K216: no 503 fallback, never an empty 200):",
      err,
    );
    throw err;
  }
}
