import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";
import { setAuthCookie } from "@/lib/auth";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Claim verification: validates ?token=&slug=, flips is_claimed, promotes any
// pending_description to the listing's real description column (mortgage = `bio`,
// TDL #604 — canonical writes `description`), sets the owner cookie, redirects
// to the portal.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");

  if (!token || !slug) {
    return NextResponse.redirect(`${SITE_URL}/claim/error`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token, pending_description")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(`${SITE_URL}/claim/error`);
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
  await supabaseAdmin.from(LISTINGS_TABLE).update(update).eq("id", listing.id);

  const response = NextResponse.redirect(`${SITE_URL}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
