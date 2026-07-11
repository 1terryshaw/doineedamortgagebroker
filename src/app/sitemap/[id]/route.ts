import { renderChunk, getSegments } from "@/lib/sitemap-chunks";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

// Child sitemaps for the /sitemap.xml index (TDL #957). Path: /sitemap/{i}.xml
// where i is 0-based. Each holds <= CHUNK_SIZE URLs, sliced from the global
// deterministic stream (see lib/sitemap-chunks.ts).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const match = /^(\d+)\.xml$/.exec(params.id);
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
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
