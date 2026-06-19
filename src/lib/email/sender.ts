import { createServiceRoleClient } from "@/lib/supabase/server";
import { JURISDICTION } from "@/lib/jurisdiction";

// Inquiry + CASL-pitch transactional email migrated off Gmail SMTP to Resend
// (notifications@smartwebsitemanagement.ca). Subject + HTML + List-Unsubscribe
// headers preserved verbatim — only the transport changed (TDL #608 C.3).
// The mortgage_email_log sent/failed audit rows are unchanged.

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateName?: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>; // TDL #472: List-Unsubscribe etc. for CASL pitches
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  templateName,
  metadata,
  headers,
}: SendEmailParams) {
  console.log("[EMAIL DEBUG] sendEmail called", {
    to,
    subject,
    templateName,
    metadata,
    htmlLength: html?.length ?? 0,
  });

  console.log("[EMAIL DEBUG] Resend config:", {
    from: JURISDICTION.emailFromName,
    keyConfigured: !!process.env.RESEND_API_KEY,
  });

  const supabase = await createServiceRoleClient();

  try {
    console.log("[EMAIL DEBUG] Attempting resend.emails.send...");
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error: sendError } = await resend.emails.send({
      from: `${JURISDICTION.emailFromName} <notifications@smartwebsitemanagement.ca>`,
      to,
      subject,
      ...(headers ? { headers } : {}),
      html,
      ...(text ? { text } : {}),
    });
    if (sendError) throw new Error(sendError.message);
    console.log("[EMAIL DEBUG] resend send succeeded", {
      id: data?.id,
    });

    const { error: logError } = await supabase.from("mortgage_email_log").insert({
      template_name: templateName,
      to_email: to,
      subject,
      status: "sent",
      metadata: metadata || {},
    });
    if (logError) {
      console.error("[EMAIL DEBUG] Failed to log sent email to DB:", logError);
    }

    return { success: true };
  } catch (error) {
    console.error("[EMAIL DEBUG] sendMail FAILED with error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[EMAIL DEBUG] Error message:", errorMessage);
    if (error instanceof Error && error.stack) {
      console.error("[EMAIL DEBUG] Stack trace:", error.stack);
    }

    const { error: logError } = await supabase.from("mortgage_email_log").insert({
      template_name: templateName,
      to_email: to,
      subject,
      status: "failed",
      error: errorMessage,
      metadata: metadata || {},
    });
    if (logError) {
      console.error("[EMAIL DEBUG] Failed to log failed email to DB:", logError);
    }

    return { success: false, error: errorMessage };
  }
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return rendered;
}
