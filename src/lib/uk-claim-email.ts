// src/lib/uk-claim-email.ts — UK claim-verification email (PARALLEL to the US/CA claim
// mail). Same Resend transport + auth@ sender, but the verify link points at the UK
// route (/api/uk/claim/verify). Kept separate so no live US/CA claim mail is touched.
import { Resend } from "resend";
import { UK_BRAND, UK_PRIMARY_COLOR } from "@/lib/uk-mortgage";

const AUTH_FROM = "Smart Website Management <auth@smartwebsitemanagement.ca>";

export type UkAuthSendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendUkClaimEmail(
  email: string,
  slug: string,
  token: string,
  firmName: string
): Promise<UkAuthSendResult> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const verifyLink = `${baseUrl}/api/uk/claim/verify?token=${encodeURIComponent(
    token
  )}&slug=${encodeURIComponent(slug)}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: AUTH_FROM,
      to: email,
      subject: `Verify your claim on ${UK_BRAND}`,
      html: `
      <h2>Claim ${firmName} on ${UK_BRAND}</h2>
      <p>Click the link below to verify you control this firm and add a free
         <strong>Verified</strong> badge to your listing:</p>
      <p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:${UK_PRIMARY_COLOR};color:white;text-decoration:none;border-radius:6px;">Verify Claim</a></p>
      <p>Or copy this link: ${verifyLink}</p>
      <p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
