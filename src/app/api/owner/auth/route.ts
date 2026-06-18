import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";
import { setAuthCookie } from "@/lib/auth";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Magic-link landing for RETURNING owners. Validates ?token=&slug= against the
// listing's owner_auth_token, sets the owner-token cookie, redirects to the portal.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");

  if (!token || !slug) {
    return NextResponse.redirect(`${SITE_URL}/owner/login?error=invalid`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(`${SITE_URL}/owner/login?error=invalid`);
  }

  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ owner_last_action_at: new Date().toISOString() })
    .eq("id", listing.id);

  const response = NextResponse.redirect(`${SITE_URL}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
