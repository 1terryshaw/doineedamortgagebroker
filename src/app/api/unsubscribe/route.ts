import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { suppressEmail } from "@/lib/suppression";

export const dynamic = "force-dynamic";

// TDL #472 claim-pitch unsubscribe for the bespoke mortgagebroker port. Writes the central
// public.email_suppressions (which isSuppressed() reads) + mirrors outreach_unsubscribed.
// Unsigned email param per the signed-off doineedapro baseline; the "u-" QP-hardening
// marker (lib/claim-pitch.unsubscribeUrl) is stripped on read.
async function suppressPitch(email: string): Promise<boolean> {
  const res = await suppressEmail(email, "claim_pitch_unsubscribe", "claim_pitch_one_click");
  try {
    const supabase = await createServiceRoleClient();
    await supabase
      .from("mortgage_listings")
      .update({ outreach_unsubscribed: true })
      .eq("email", email);
  } catch {
    /* mirror is best-effort */
  }
  return res.ok;
}

function page(title: string, body: string) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:sans-serif;max-width:600px;margin:60px auto;text-align:center">` +
      `<h1>${title}</h1>${body}</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const scope = searchParams.get("scope");

  if (scope === "pitch" && email) {
    await suppressPitch(email.replace(/^u-/, ""));
    return page(
      "You have been unsubscribed",
      "<p>You will not receive any more listing-claim emails from us at this address.</p>" +
        "<p>If this was a mistake, reply to terry@marketingteaminabox.com</p>"
    );
  }

  return new NextResponse(
    "<html><body style=\"font-family:sans-serif;text-align:center;padding:60px\"><h2>Invalid unsubscribe link</h2><p>This link is missing required parameters.</p></body></html>",
    { status: 400, headers: { "Content-Type": "text/html" } }
  );
}

// RFC 8058 one-click unsubscribe — mail clients POST here for claim-pitch CEMs.
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const ok = await suppressPitch(email.replace(/^u-/, ""));
  return NextResponse.json({ success: ok });
}
