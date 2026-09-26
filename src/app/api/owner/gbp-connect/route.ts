import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyOwnerAccess } from "@/lib/auth";
import { GBP_OWNER_MESSAGES, resolveGoogleBusinessProfileUrl } from "@/lib/gbp-connector";
import { upgradeFeatureIdToChij } from "@/lib/gbp-chij-resolve";
import { LISTINGS_TABLE, supabaseAdmin } from "@/lib/supabase-admin";
import { fetchInitialRating } from "@/lib/gbp-initial-rating";

export const dynamic = "force-dynamic";

// claimant-edit-ux-stamp-v1 follow-up (Terry 2026-09-25, item 3): the fleet's single-door GBP writer.
// owner-funnel-recovery-p1p4-v1 P2 (2026-09-26): brought into the paste-time ChIJ class (see below).
// Owner-cookie + token + claimed gated; 409 already_linked; provenance row.
const purgeTag = revalidateTag as unknown as (tag: string, profile?: { expire: number }) => void;
const HINT = " Tip: on Google Maps, open your business, tap Share, then Copy link, and paste that link here.";

export async function POST(request: NextRequest) {
  let body: { slug?: unknown; gbpUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_url", message: GBP_OWNER_MESSAGES.invalid_url }, { status: 400 });
  }
  const access = typeof body.slug === "string" ? await verifyOwnerAccess(body.slug) : null;
  if (!access) return NextResponse.json({ ok: false, error: "unauthenticated", message: "Please sign in to connect Google." }, { status: 401 });
  const listing = access.listing as { id: string; slug: string; owner_auth_token: string; claimed?: boolean | null; is_claimed?: boolean | null };
  if (!(listing.claimed === true || listing.is_claimed === true) || typeof body.gbpUrl !== "string") {
    return NextResponse.json({ ok: false, error: "not_authorized", message: "Your account cannot connect this listing." }, { status: 403 });
  }

  const resolution = await resolveGoogleBusinessProfileUrl(body.gbpUrl);
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.code, message: GBP_OWNER_MESSAGES[resolution.code] + HINT }, { status: 400 });
  }

  // owner-funnel-recovery-p1p4-v1 P2: paste-time ChIJ upgrade (K288 / TDL #1256, K308 service-area + CID
  // identity) — the canonical behaviour of the harness fleet. ONE owner-triggered Text Search only when the
  // link resolved to a feature-id; a ChIJ is accepted only on a verified match; every refusal keeps the
  // feature-id (connected, never NULL). Shared fleet-wide daily cap (lib/gbp-chij-resolve DAILY_CALL_CAP).
  const chijUpgrade = await upgradeFeatureIdToChij({
    placeId: resolution.placeId,
    anchor: resolution.anchor,
    listingId: listing.id,
    listingSlug: listing.slug,
    listingsTable: LISTINGS_TABLE,
    placeIdColumn: "google_place_id",
    vertical: process.env.BILLING_VERTICAL_SLUG ?? LISTINGS_TABLE.replace(/_listings$/, ""),
    supabase: supabaseAdmin,
  });
  const effectivePlaceId = chijUpgrade.placeId;

  // owner-funnel-recovery-p1p4-v1 P2c: never downgrade a stored ChIJ. If this listing already has a ChIJ and the
  // new paste did not end in one, nothing is written (no feature-id over a working ChIJ, no link/place mismatch).
  if (((listing as { google_place_id?: string | null }).google_place_id ?? "").startsWith("ChIJ") && !effectivePlaceId.startsWith("ChIJ")) {
    return NextResponse.json({ ok: false, error: "kept_existing", message: "Your listing is already connected to Google, and we couldn't confirm the new link, so nothing was changed. If you are replacing your Google profile, contact support." }, { status: 422 });
  }

  const { error: updateError, count } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ google_place_id: effectivePlaceId, gbp_url: resolution.normalizedUrl }, { count: "exact" })
    .eq("id", listing.id)
    .eq("owner_auth_token", listing.owner_auth_token);
  if (updateError || count !== 1) {
    const isUnique = updateError?.code === "23505" || /unique|duplicate key/i.test(updateError?.message || "");
    if (isUnique) {
      const { data: existing } = await supabaseAdmin.from(LISTINGS_TABLE).select("id").eq("google_place_id", effectivePlaceId).maybeSingle();
      await supabaseAdmin.from("place_id_collision_log").insert({
        source_table: LISTINGS_TABLE,
        vertical: process.env.BILLING_VERTICAL_SLUG ?? LISTINGS_TABLE.replace(/_listings$/, ""),
        attempting_listing_id: listing.id,
        existing_listing_id: (existing as { id?: string } | null)?.id ?? null,
        place_id: effectivePlaceId,
      }).then(() => {}, () => {});
      return NextResponse.json({
        ok: false,
        error: "already_linked",
        message: "That Google listing is already linked to another business in our directory. If it belongs to you, contact support and we'll get it sorted.",
      }, { status: 409 });
    }
    if (updateError) console.error("[owner/gbp-connect] restricted write failed", updateError.code);
    return NextResponse.json({ ok: false, error: "connection_not_saved", message: "We could not save the connection. Please try again." }, { status: 500 });
  }

  // Provenance (TDL #1256): the owner supplied this link himself. places_called is false by construction.
  await supabaseAdmin.from("empire_places_refresh_log").insert({
    vertical: process.env.BILLING_VERTICAL_SLUG ?? LISTINGS_TABLE.replace(/_listings$/, ""),
    listing_table: LISTINGS_TABLE,
    listing_id: listing.id,
    listing_slug: listing.slug,
    place_id: effectivePlaceId,
    outcome: "success",
    caller: "owner",
    authorization_ref: "provenance=owner_supplied (gbp-connect, TDL #1256)",
    places_called: false,
    detail: `gbp-connect resolve mode=${resolution.mode} chij=${chijUpgrade.outcome}`,
  }).then(() => {}, () => {});

  try {
    revalidatePath(`/owner/${listing.slug}`);
    revalidatePath(`/directory/${listing.slug}`);
    purgeTag(`listing:${listing.slug}`, { expire: 0 });
  } catch (error) {
    console.error("[owner/gbp-connect] cache invalidation failed", error instanceof Error ? error.name : "unknown");
  }

  // owner-funnel-recovery-p1p4-v1 P2 addendum (Prosafe): a connected ChIJ gets its Google rating/count NOW
  // (owner-triggered, already-seeded row, shared 200/day tripwire, no review text) and the public page is
  // revalidated, so the listing shows the rating + "Reviews verified" instead of staying "Claimed" forever.
  let initialRating: string | null = null;
  if (effectivePlaceId.startsWith("ChIJ")) {
    try {
      const { data: cur } = await supabaseAdmin.from(LISTINGS_TABLE).select("google_rating").eq("id", listing.id).maybeSingle();
      const hasRating = Number((cur as { google_rating?: number | null } | null)?.google_rating) > 0;
      if ((listing as { google_place_id?: string | null }).google_place_id !== effectivePlaceId || !hasRating) {
        initialRating = (await fetchInitialRating({ listingId: String(listing.id), listingSlug: listing.slug, placeId: effectivePlaceId,
          listingsTable: LISTINGS_TABLE, vertical: process.env.BILLING_VERTICAL_SLUG ?? LISTINGS_TABLE.replace(/_listings$/, ""),
          supabase: supabaseAdmin })).outcome;
      }
    } catch { initialRating = "error_places"; }
    try { revalidatePath(`/directory/${listing.slug}`); } catch { /* best effort */ }
  }
  return NextResponse.json({ ok: true, initialRating, placeId: effectivePlaceId, gbpUrl: resolution.normalizedUrl, mode: resolution.mode, chij: chijUpgrade.outcome });
}
