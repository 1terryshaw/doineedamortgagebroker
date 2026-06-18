import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthFromCookies } from "@/lib/auth";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Owner portal leads. Mortgage's lead model is `mortgage_inquiries`
// (listing_id = uuid), NOT the canonical's `leads_forwarded` composite-key table.
export async function GET() {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);

  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: listing, error: listingErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, slug, owner_auth_token")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data: leads, error: leadsErr } = await supabaseAdmin
    .from("mortgage_inquiries")
    .select(
      "id, sender_name, sender_email, sender_phone, message, loan_type, status, created_at"
    )
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (leadsErr) {
    console.error("Failed to fetch leads:", leadsErr.message);
    return NextResponse.json({ leads: [] });
  }

  return NextResponse.json({ leads: leads || [] });
}
