import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail, renderTemplate } from "@/lib/email/sender";
import {
  shouldSilentDrop,
  isValidEmail,
  looksLikeBotContent,
  effectiveForwardEmail,
} from "@/lib/inquiry-guard";
import { shouldPitch, buildClaimPitchEmail } from "@/lib/claim-pitch";
import { isSuppressed } from "@/lib/suppression";

// Manual-bridge queue for inquiries to listings with no deliverable email.
const ADMIN_EMAIL = "terry@doineedapro.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      listing_id,
      name,
      email,
      phone,
      mortgage_type,
      message,
      honeypot,
      renderedAt,
    } = body;

    // Silent drop — honeypot / sub-2.5s only. Return ok so bots learn nothing (TDL #455 W1).
    if (shouldSilentDrop({ honeypot, renderedAt })) {
      return NextResponse.json({ success: true });
    }

    // Validate required fields
    if (!name || !email || !listing_id) {
      return NextResponse.json(
        { error: "Name, email, and listing are required." },
        { status: 400 }
      );
    }

    // Malformed/junk submitter email -> 400 so a human typo is correctable.
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleClient();

    // Fetch the listing first — disposition depends on whether it has a deliverable address.
    const { data: listing } = await supabase
      .from("mortgage_listings")
      .select(
        "id, slug, name, email, owner_email, claimed, tier, subscription_tier, last_claim_pitch_at"
      )
      .eq("id", listing_id)
      .single();

    // ── Disposition (TDL #455): forward ONLY to a validated address, never raw listing.email ──
    const fwdEmail = listing ? effectiveForwardEmail(listing) : null;
    const isBot = looksLikeBotContent({ name, message, email });
    const status = isBot ? "spam_review" : fwdEmail ? "new" : "needs_bridging";

    // Always store one disposition row — mortgage_inquiries is the ledger; nothing lost.
    const { data: inquiry, error: inquiryError } = await supabase
      .from("mortgage_inquiries")
      .insert({
        listing_id: listing_id || null,
        sender_name: name,
        sender_email: email,
        sender_phone: phone || null,
        loan_type: mortgage_type || null,
        message: message || "",
        status,
      })
      .select()
      .single();

    if (inquiryError) {
      console.error("Error inserting inquiry:", inquiryError);
      return NextResponse.json(
        { error: "Failed to submit inquiry. Please try again." },
        { status: 500 }
      );
    }

    // tdl455canary / SMOKE_TEST: skip real dispatch for test traffic; the disposition row still persists.
    const smoke = /tdl455canary/i.test(email || "") || process.env.SMOKE_TEST === "1";

    // Quarantined spam: stored, never forwarded, never notified.
    if (status === "spam_review") {
      return NextResponse.json({ success: true, id: inquiry.id, forwarded: false });
    }

    // No deliverable address: surface to the admin manual-bridge queue, do not forward.
    if (status === "needs_bridging") {
      if (!smoke) {
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: `[needs_bridging] inquiry for ${listing?.name || "unknown listing"}`,
          html: `<p>An inquiry was received for a listing with no deliverable email (needs manual bridging).</p>
                 <p><strong>From:</strong> ${name} (${email}${phone ? `, ${phone}` : ""})</p>
                 <p><strong>Listing:</strong> ${listing?.name || listing_id}</p>
                 <p><strong>Message:</strong> ${message || "(none)"}</p>`,
          templateName: "inquiry_needs_bridging",
          metadata: { inquiry_id: inquiry.id, listing_id },
        }).catch(() => {});
      }
      return NextResponse.json({ success: true, id: inquiry.id, forwarded: false });
    }

    // status === "new": forward to the VALIDATED address only.
    const forwardTo = fwdEmail!;
    const caslReady = !!(process.env.CASL_POSTAL_ADDRESS || "").trim();
    let pitched = false;

    if (!smoke) {
      // TDL #472 Lead-to-Claim: pitch an unclaimed + non-paying + not-recently-pitched +
      // not-suppressed listing with a CASL claim-pitch email (CTA -> /signup); else the
      // normal template notification. (US rows lack email, so this rarely fires.)
      if (shouldPitch(listing!) && caslReady && !(await isSuppressed(forwardTo))) {
        const pitch = buildClaimPitchEmail({
          to: forwardTo,
          slug: listing!.slug,
          businessName: listing!.name,
          inquirerName: name,
          inquirerEmail: email,
          inquirerPhone: phone,
          mortgageType: mortgage_type,
          message,
          leadId: inquiry.id,
        });
        if (pitch) {
          await sendEmail({
            to: forwardTo,
            subject: pitch.subject,
            html: pitch.html,
            text: pitch.text,
            headers: pitch.headers,
            templateName: "claim_pitch_forward",
            metadata: { inquiry_id: inquiry.id, listing_id },
          }).catch(() => {});
          pitched = true;
          await supabase
            .from("mortgage_listings")
            .update({ last_claim_pitch_at: new Date().toISOString() })
            .eq("id", listing!.id);
        }
      }

      const { data: notificationTemplate, error: notificationTemplateError } =
        await supabase
          .from("mortgage_email_templates")
          .select("*")
          .eq("name", "inquiry_notification")
          .single();

      if (notificationTemplateError || !notificationTemplate) {
        console.error(
          "Error loading inquiry_notification template:",
          notificationTemplateError
        );
      }

      if (!pitched && notificationTemplate) {
        const templateVars: Record<string, string> = {
          broker_name: listing!.name,
          inquirer_name: name,
          inquirer_email: email,
          inquirer_phone: phone || "Not provided",
          mortgage_type: mortgage_type || "Not specified",
          message: message || "No message provided",
        };
        const html = renderTemplate(notificationTemplate.html_body, templateVars);
        const subject = renderTemplate(notificationTemplate.subject, templateVars);
        await sendEmail({
          to: forwardTo,
          subject,
          html,
          templateName: "inquiry_notification",
          metadata: { inquiry_id: inquiry.id, listing_id },
        }).catch(() => {});
      }

      // Branded confirmation to the inquirer.
      const { data: confirmationTemplate, error: confirmationTemplateError } =
        await supabase
          .from("mortgage_email_templates")
          .select("*")
          .eq("name", "inquiry_confirmation")
          .single();

      if (confirmationTemplateError || !confirmationTemplate) {
        console.error(
          "Error loading inquiry_confirmation template:",
          confirmationTemplateError
        );
      }

      if (confirmationTemplate) {
        const confirmVars: Record<string, string> = {
          inquirer_name: name,
          broker_name: listing!.name,
          mortgage_type: mortgage_type || "Not specified",
        };
        const html = renderTemplate(confirmationTemplate.html_body, confirmVars);
        const subject = renderTemplate(confirmationTemplate.subject, confirmVars);
        await sendEmail({
          to: email,
          subject,
          html,
          templateName: "inquiry_confirmation",
          metadata: { inquiry_id: inquiry.id, listing_id },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, id: inquiry.id, forwarded: true, pitched });
  } catch (error) {
    console.error("Inquiry API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
