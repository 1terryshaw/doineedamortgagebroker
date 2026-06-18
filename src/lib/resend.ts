import { Resend } from "resend";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { canonical } from "@/lib/vertical-canonical";

// Transactional auth sender (owner login + claim verification), ported from
// doineedanaccountant lib/resend.ts (TDL #624). Uses Resend, NOT mortgage's
// Gmail/nodemailer inquiry path — auth links are deliberately on the verified
// auth@ sender for deliverability. baseUrl = SITE_URL (mortgage uses
// NEXT_PUBLIC_SITE_URL, not the canonical's NEXT_PUBLIC_BASE_URL).
const AUTH_FROM = "Smart Website Management <auth@smartwebsitemanagement.ca>";

export type AuthSendResult = { ok: true; id: string } | { ok: false; error: string };

/** Owner-login magic link → /api/owner/auth?token=&slug= (both params required). */
export async function sendMagicLink(
  email: string,
  slug: string,
  token: string
): Promise<AuthSendResult> {
  const magicLink = `${SITE_URL}/api/owner/auth?token=${token}&slug=${slug}`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: AUTH_FROM,
      to: email,
      subject: `Your login link for ${SITE_NAME}`,
      html: `
      <h2>Welcome back to ${SITE_NAME}</h2>
      <p>Click the link below to access your listing dashboard:</p>
      <p><a href="${magicLink}" style="display:inline-block;padding:12px 24px;background:${canonical.primaryColor};color:white;text-decoration:none;border-radius:6px;">Access Dashboard</a></p>
      <p>Or copy this link: ${magicLink}</p>
      <p>This link will log you in and is valid for 30 days.</p>
      <p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Claim-verification email → /api/claim/verify?token=&slug= (both params required). */
export async function sendClaimEmail(
  email: string,
  slug: string,
  claimToken: string
): Promise<AuthSendResult> {
  const verifyLink = `${SITE_URL}/api/claim/verify?token=${claimToken}&slug=${slug}`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: AUTH_FROM,
      to: email,
      subject: `Verify your claim on ${SITE_NAME}`,
      html: `
      <h2>Claim Your Listing on ${SITE_NAME}</h2>
      <p>Click the link below to verify your ownership claim:</p>
      <p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:${canonical.primaryColor};color:white;text-decoration:none;border-radius:6px;">Verify Claim</a></p>
      <p>Or copy this link: ${verifyLink}</p>
      <p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
