import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail, renderTemplate } from "@/lib/email/sender";

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
    } = body;

    // Validate required fields
    if (!name || !email || !listing_id) {
      return NextResponse.json(
        { error: "Name, email, and listing are required." },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleClient();

    // Insert inquiry
    const { data: inquiry, error: inquiryError } = await supabase
      .from("mortgage_inquiries")
      .insert({
        listing_id,
        name,
        email,
        phone: phone || null,
        mortgage_type: mortgage_type || null,
        message: message || null,
        status: "new",
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

    // Fetch the listing to get broker email
    console.log("[INQUIRY DEBUG] Fetching listing for id:", listing_id);
    const { data: listing, error: listingError } = await supabase
      .from("mortgage_listings")
      .select("id, name, email")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      console.error("[INQUIRY DEBUG] Error fetching listing:", listingError);
      console.log("[INQUIRY DEBUG] Returning early — no listing found, but inquiry was saved");
      // Inquiry was still saved, so return success
      return NextResponse.json({ success: true, id: inquiry.id });
    }

    console.log("[INQUIRY DEBUG] Listing found:", {
      id: listing.id,
      name: listing.name,
      hasEmail: !!listing.email,
    });

    // Send notification email to broker
    if (listing.email) {
      console.log("[INQUIRY DEBUG] Fetching inquiry_notification template...");
      const { data: notificationTemplate, error: notifTplError } = await supabase
        .from("mortgage_email_templates")
        .select("*")
        .eq("name", "inquiry_notification")
        .eq("active", true)
        .single();

      console.log("[INQUIRY DEBUG] inquiry_notification template result:", {
        found: !!notificationTemplate,
        error: notifTplError?.message || null,
      });

      if (notificationTemplate) {
        const templateVars: Record<string, string> = {
          broker_name: listing.name,
          inquirer_name: name,
          inquirer_email: email,
          inquirer_phone: phone || "Not provided",
          mortgage_type: mortgage_type || "Not specified",
          message: message || "No message provided",
        };

        const html = renderTemplate(notificationTemplate.html_body, templateVars);
        const subject = renderTemplate(notificationTemplate.subject, templateVars);

        console.log("[INQUIRY DEBUG] Sending inquiry_notification email to broker:", listing.email);
        const notifResult = await sendEmail({
          to: listing.email,
          subject,
          html,
          templateName: "inquiry_notification",
          metadata: { inquiry_id: inquiry.id, listing_id },
        });
        console.log("[INQUIRY DEBUG] inquiry_notification result:", notifResult);

        if (!notifResult.success) {
          console.error(
            `[INQUIRY DEBUG] SMTP error sending inquiry_notification to ${listing.email}:`,
            notifResult.error
          );
        }
      } else {
        console.warn("[INQUIRY DEBUG] No active inquiry_notification template found — skipping broker email");
      }
    } else {
      console.warn("[INQUIRY DEBUG] Listing has no email — skipping broker notification");
    }

    // Send confirmation email to the inquirer
    console.log("[INQUIRY DEBUG] Fetching inquiry_confirmation template...");
    const { data: confirmationTemplate, error: confirmTplError } = await supabase
      .from("mortgage_email_templates")
      .select("*")
      .eq("name", "inquiry_confirmation")
      .eq("active", true)
      .single();

    console.log("[INQUIRY DEBUG] inquiry_confirmation template result:", {
      found: !!confirmationTemplate,
      error: confirmTplError?.message || null,
    });

    if (confirmationTemplate) {
      const confirmVars: Record<string, string> = {
        inquirer_name: name,
        broker_name: listing.name,
        mortgage_type: mortgage_type || "Not specified",
      };

      const html = renderTemplate(confirmationTemplate.html_body, confirmVars);
      const subject = renderTemplate(confirmationTemplate.subject, confirmVars);

      console.log("[INQUIRY DEBUG] Sending inquiry_confirmation email to inquirer:", email);
      const confirmResult = await sendEmail({
        to: email,
        subject,
        html,
        templateName: "inquiry_confirmation",
        metadata: { inquiry_id: inquiry.id, listing_id },
      });
      console.log("[INQUIRY DEBUG] inquiry_confirmation result:", confirmResult);

      if (!confirmResult.success) {
        console.error(
          `[INQUIRY DEBUG] SMTP error sending inquiry_confirmation to ${email}:`,
          confirmResult.error
        );
      }
    } else {
      console.warn("[INQUIRY DEBUG] No active inquiry_confirmation template found — skipping confirmation email");
    }

    return NextResponse.json({ success: true, id: inquiry.id });
  } catch (error) {
    console.error("Inquiry API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
