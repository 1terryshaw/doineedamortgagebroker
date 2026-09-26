import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthFromCookies, setAuthCookie } from "@/lib/auth";
import { touchOwnerSession } from "@/lib/owner-events";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET() {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);

  if (!auth) {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("slug, owner_email, owner_auth_token_expires_at")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (error || !listing) {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }
  // P4 sliding session: active use renews the token window (capped); a server-side revocation signs out.
  const session = await touchOwnerSession(auth.slug, auth.token, listing.owner_auth_token_expires_at as string | null);
  if (session === "revoked") {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }

  const response = NextResponse.json(
    { authenticated: true, slug: listing.slug, ownerEmail: listing.owner_email },
    { headers: NO_CACHE_HEADERS }
  );
  if (session === "renewed") setAuthCookie(response, auth.token, auth.slug);
  return response;
}
