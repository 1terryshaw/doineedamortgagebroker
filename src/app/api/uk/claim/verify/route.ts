import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { UK_TABLE } from "@/lib/uk-mortgage";

export const dynamic = "force-dynamic";

// Verifies the magic-link token and flips the UK listing to Verified. No payment, no
// owner cookie/dashboard this session. On success -> firm page showing the Verified badge.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  if (!token || !slug) {
    return NextResponse.redirect(`${siteUrl}/uk`);
  }

  const { data: firm, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select("id, owner_auth_token, company_number")
    .eq("company_number", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !firm || !firm.owner_auth_token || firm.owner_auth_token !== token) {
    return NextResponse.redirect(`${siteUrl}/uk`);
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from(UK_TABLE)
    .update({ is_claimed: true, claimed_at: now, updated_at: now })
    .eq("id", firm.id);

  return NextResponse.redirect(`${siteUrl}/uk/directory/${firm.company_number}?claimed=1`);
}
