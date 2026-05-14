import nodemailer from "nodemailer";
import { createServiceRoleClient } from "@/lib/supabase/server";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateName?: string;
  metadata?: Record<string, unknown>;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  templateName,
  metadata,
}: SendEmailParams) {
  console.log("[EMAIL DEBUG] sendEmail called", {
    to,
    subject,
    templateName,
    metadata,
    htmlLength: html?.length ?? 0,
  });

  console.log("[EMAIL DEBUG] SMTP config:", {
    service: "gmail",
    user: process.env.GMAIL_USER || "NOT SET",
    passConfigured: !!process.env.GMAIL_APP_PASSWORD,
  });

  const supabase = await createServiceRoleClient();

  try {
    console.log("[EMAIL DEBUG] Attempting transporter.sendMail...");
    const info = await transporter.sendMail({
      from: `"DoINeedAMortgageBroker" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || undefined,
    });
    console.log("[EMAIL DEBUG] sendMail succeeded", {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    const { error: logError } = await supabase.from("mortgage_email_log").insert({
      template_name: templateName,
      recipient_email: to,
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
      recipient_email: to,
      subject,
      status: "failed",
      error_message: errorMessage,
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
