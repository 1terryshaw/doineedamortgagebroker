import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";
import { sendMagicLink } from "@/lib/resend";

// RETURNING owner login: email -> magic link to the first claimed listing owned
// by that owner_email. Always returns success (anti-enumeration).
export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const { data: listings, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("slug, owner_auth_token, owner_email")
    .ilike("owner_email", email)
    .eq("is_claimed", true);

  if (error || !listings || listings.length === 0) {
    return NextResponse.json({ success: true });
  }

  const listing = listings[0];
  const emailRedacted = String(email).replace(/(.{2}).+(@.+)/, "$1***$2");
  try {
    const result = await sendMagicLink(email, listing.slug, listing.owner_auth_token);
    if (result.ok) {
      console.log(
        JSON.stringify({ event: "owner_login_send_ok", email_redacted: emailRedacted, slug: listing.slug, resend_id: result.id })
      );
    } else {
      console.error(
        JSON.stringify({ event: "owner_login_send_error", email_redacted: emailRedacted, slug: listing.slug, err: result.error })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({ event: "owner_login_send_error", email_redacted: emailRedacted, slug: listing.slug, err: String(err) })
    );
  }
  return NextResponse.json({ success: true });
}
