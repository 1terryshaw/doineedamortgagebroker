import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";
import { setAuthCookie } from "@/lib/auth";
import { SITE_URL } from "@/lib/constants";
import { canRepublishOnClaim } from "@/lib/republish-guard";

export const dynamic = "force-dynamic";

// Claim verification: validates ?token=&slug=, flips is_claimed, promotes any
// pending_description to the listing's real description column (mortgage = `bio`,
// TDL #604 — canonical writes `description`), sets the owner cookie, redirects
// to the portal.
// ═══════════════════════════════════════════════════════════════════════════════
// GET DOES NOT WRITE. POST DOES. (recon-v1 §D step 4 · ruling R2 · fan 2026-09-11)
//
// This route used to expose the claim write — claimed=true, claimed_at, and (where the
// repo carries the #1068 republish guard) the is_published false→true flip — as a GET,
// and that GET's URL was what we MAILED to owners. Every link-safety rewriter, mail
// scanner and inbox link previewer that prefetches URLs in inbound mail was therefore
// able to complete a claim, and publish a listing, without the recipient ever opening
// the message. The resulting row is byte-identical to a genuine claim, so it cannot be
// told apart afterwards, let alone undone.
//
// The split below is the fix, and it is the plain HTTP contract: GET is safe, POST is
// not. GET now only redirects to /claim/verify, the interstitial page, carrying the same
// query string; the page shows the owner what they are about to claim and gives them one
// button, which POSTs here. A scanner following the mailed link lands on a page and
// stops. A human lands on the same page and clicks.
//
// TOKENS ALREADY IN THE WILD KEEP WORKING. The mailed URL is unchanged in shape and the
// token is unchanged in meaning — an owner holding a link from weeks ago follows it, gets
// bounced to the interstitial, and confirms. Nothing was invalidated.
//
// REDIRECTS FROM POST MUST BE 303, NOT 307. NextResponse.redirect() defaults to 307,
// which PRESERVES the method — the browser would re-POST to /owner/<slug> and to
// /claim/error, neither of which accepts a POST. 303 See Other is the status that turns a
// POST result into a GET of the destination. Every redirect on this path says 303
// explicitly for that reason; do not drop the argument.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // Zero reads, zero writes, zero DB access. Deliberately does NOT validate the token:
  // there is nothing to protect yet, and validating here would only duplicate the two
  // places that do it for real (the interstitial page, then POST below). Preserve the
  // query string verbatim so the interstitial sees exactly what was mailed.
  const { searchParams } = new URL(request.url);
  const siteUrl = SITE_URL;
  const qs = searchParams.toString();
  return NextResponse.redirect(`${siteUrl}/claim/verify${qs ? `?${qs}` : ""}`, 302);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Accept the interstitial's form post, and fall back to the query string so a POST
  // carrying its parameters either way behaves identically.
  let token = searchParams.get("token");
  let slug = searchParams.get("slug");
  try {
    const form = await request.formData();
    token = (form.get("token") as string | null) ?? token;
    slug = (form.get("slug") as string | null) ?? slug;
  } catch {
    // No body / not form-encoded — the query-string values above stand.
  }

  if (!token || !slug) {
    return NextResponse.redirect(`${SITE_URL}/claim/error`, 303);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token, pending_description, is_published, deserve_reason, name, owner_auth_token_expires_at")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(`${SITE_URL}/claim/error`, 303);
  }

  // Token expiry — enforced ONLY when set. Self-serve submissions stamp a 24h
  // owner_auth_token_expires_at; seeded/organic claim tokens leave it NULL and never expire,
  // so this cannot regress the pre-existing claim path. (claim-token-expiry-and-remint-v2)
  if (listing.owner_auth_token_expires_at && new Date(listing.owner_auth_token_expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(`${SITE_URL}/claim/error`, 303);
  }

  const update: Record<string, unknown> = {
    claimed_at: new Date().toISOString(),
    is_claimed: true,
    updated_at: new Date().toISOString(),
    pending_description: null,
  };
  if (listing.pending_description) {
    // Mortgage's real long-description column is `bio`, not `description` (#604).
    update.bio = listing.pending_description;
  }
  // TDL #1068 — republish-on-claim. A verified claim is consent from the listing's
  // subject, so a de-served SEEDED person-row republishes here. canRepublishOnClaim
  // fails CLOSED: only NULL / person-consent-curable deserve_reasons publish;
  // RESTRICTED-source and nameless rows stay down (consent ≠ SOURCE cure, #1014).
  if (canRepublishOnClaim(listing)) {
    update.is_published = true;
    update.deserve_reason = null;
    update.deserved_at = null;
  }
  await supabaseAdmin.from(LISTINGS_TABLE).update(update).eq("id", listing.id);

  const response = NextResponse.redirect(`${SITE_URL}/owner/${slug}`, 303);
  setAuthCookie(response, token, slug);
  return response;
}
