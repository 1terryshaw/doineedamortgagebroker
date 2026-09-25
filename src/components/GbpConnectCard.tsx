"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// claimant-edit-ux-stamp-v1 follow-up (item 3): the fleet's standard dashboard "Connect your Google
// Business Profile" card, packaged for this site's server-rendered owner page. Posts to the single
// GBP writer /api/owner/gbp-connect (feature-id only here — no Places call).
export default function GbpConnectCard({
  slug,
  googlePlaceId,
  gbpUrlOnFile,
  primaryColor,
}: {
  slug: string;
  googlePlaceId: string | null;
  gbpUrlOnFile: string | null;
  primaryColor: string;
}) {
  const router = useRouter();
  const [gbpUrl, setGbpUrl] = useState("");
  const [connectingGbp, setConnectingGbp] = useState(false);
  const [gbpResult, setGbpResult] = useState("");
  const [connectedPlaceId, setConnectedPlaceId] = useState<string | null>(googlePlaceId || null);
  const [connectedGbpUrl, setConnectedGbpUrl] = useState<string>(gbpUrlOnFile || "");
  const [editingGbp, setEditingGbp] = useState(false);

  async function handleConnectGbp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectingGbp(true);
    setGbpResult("");
    try {
      const response = await fetch("/api/owner/gbp-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, gbpUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "We could not connect Google.");
      setConnectedPlaceId(data.placeId);
      setConnectedGbpUrl(data.gbpUrl || gbpUrl);
      setEditingGbp(false);
      setGbpUrl("");
      // claimant-edit-ux-stamp-v1: honest result. This site stores the link's own id (no Places
      // verification), so a Share link is connected but not review-capable.
      setGbpResult(
        typeof data.placeId === "string" && data.placeId.startsWith("ChIJ")
          ? "Connected. Your Google rating can show on your listing."
          : "Connected. Your Google profile is linked; showing Google reviews isn't available for this link yet.",
      );
      router.refresh();
    } catch (error) {
      setGbpResult(error instanceof Error ? error.message : "We could not connect Google.");
    } finally {
      setConnectingGbp(false);
    }
  }

  return (
    <>
      {/* GBP connect box — one coherent block, state-aware on google_place_id. */}
      <section className="border rounded-lg p-6" aria-labelledby="google-gbp-heading">
        {!connectedPlaceId ? (
          <>
            <h3 id="google-gbp-heading" className="font-semibold mb-2">Connect your Google Business Profile</h3>
            <p className="text-sm text-gray-600 mb-4">Paste the HTTPS Google Maps or Business Profile share link for this listing. We only save a valid Google Place ID; reviews will not refresh automatically.</p>
            <form onSubmit={handleConnectGbp} className="space-y-3">
              <label htmlFor="gbp-url" className="block text-sm font-medium text-gray-700">Google Business Profile link</label>
              <div className="flex flex-col gap-2 sm:flex-row"><input id="gbp-url" type="url" required value={gbpUrl} onChange={(event) => setGbpUrl(event.target.value)} placeholder="https://maps.app.goo.gl/..." className="min-w-0 flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" /><button type="submit" disabled={connectingGbp} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: primaryColor }}>{connectingGbp ? "Connecting…" : "Connect Google"}</button></div>
              {connectedGbpUrl && (
                <p className="text-sm text-blue-700">A Google Business Profile link is on file — click Connect to verify it</p>
              )}
            </form>
          </>
        ) : (
          <>
            <h3 id="google-gbp-heading" className="font-semibold mb-2 text-green-700">✓ Google connected</h3>
            {connectedGbpUrl && (
              <p className="text-sm text-gray-600 mb-2 break-all">Linked profile:{" "}<a href={connectedGbpUrl} target="_blank" rel="noopener noreferrer" className="underline">{connectedGbpUrl}</a></p>
            )}
            <p className="text-sm text-gray-600 mb-4">Once your Google rating is available it shows on your public listing, which earns the &ldquo;Reviews verified&rdquo; badge.</p>
            {editingGbp ? (
              <form onSubmit={handleConnectGbp} className="space-y-3">
                <label htmlFor="gbp-url" className="block text-sm font-medium text-gray-700">Replace Google Business Profile link</label>
                <div className="flex flex-col gap-2 sm:flex-row"><input id="gbp-url" type="url" required value={gbpUrl} onChange={(event) => setGbpUrl(event.target.value)} placeholder="https://maps.app.goo.gl/..." className="min-w-0 flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" /><button type="submit" disabled={connectingGbp} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: primaryColor }}>{connectingGbp ? "Saving…" : "Replace"}</button><button type="button" onClick={() => { setEditingGbp(false); setGbpUrl(""); }} className="rounded px-4 py-2 text-sm font-medium text-gray-600 underline">Cancel</button></div>
              </form>
            ) : (
              <button type="button" onClick={() => { setEditingGbp(true); setGbpUrl(connectedGbpUrl); }} className="text-sm font-medium underline" style={{ color: primaryColor }}>Edit / Replace link</button>
            )}
          </>
        )}
        {gbpResult && <p role="status" className="mt-3 text-sm text-gray-700">{gbpResult}</p>}
      </section>
    </>
  );
}
