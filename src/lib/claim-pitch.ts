// src/lib/claim-pitch.ts — TDL #472 lead-to-claim (mortgagebroker bespoke port).
// CTA destination is /claim/{slug} (empire-standard owner-token claim flow, TDL #624).

import { JURISDICTION } from "@/lib/jurisdiction";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://doineedamortgagebroker.com").replace(/\/$/, "");
const DISPLAY_DOMAIN = SITE_URL.replace(/^https?:\/\//, "").replace(/^www\./, "");
// Brand + TLD, country-keyed: DoINeedAMortgageBroker.com / FindMyMortgageBroker.ca
const DIRECTORY_NAME = `${JURISDICTION.brandName}.${DISPLAY_DOMAIN.split(".").pop()}`;
const CASL_SENDER = "Smart Website Management";
const PITCH_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000; // <= 1 pitch / 14 days / recipient

// TDL #624: mortgage moved off the /signup flow onto the empire-standard
// /claim/{slug} owner-token claim flow (was the documented manifest exception).
export const CLAIM_PATH = "/claim/{slug}";
export const VERTICAL_KEY = "mortgagebroker";

export interface PitchListing {
  id: string;
  claimed?: boolean | null;
  last_claim_pitch_at?: string | null;
  tier?: string | null;
  subscription_tier?: string | null;
  stripe_subscription_id?: string | null;
}

function hasActiveSubscription(l: PitchListing): boolean {
  if (l.stripe_subscription_id) return true;
  const t = (l.tier || l.subscription_tier || "").trim().toLowerCase();
  return t !== "" && t !== "free" && t !== "seed" && t !== "unclaimed";
}

export function shouldPitch(l: PitchListing): boolean {
  if (l.claimed) return false;
  if (hasActiveSubscription(l)) return false;
  const last = l.last_claim_pitch_at ? Date.parse(l.last_claim_pitch_at) : 0;
  if (Number.isNaN(last)) return true;
  return Date.now() - last > PITCH_INTERVAL_MS;
}

// Tracked claim link -> /claim/{slug}. lid carries the "i-" QP-hardening marker
// (a UUID leadId starting with 2 hex chars would otherwise be quoted-printable-mangled).
export function claimUrl(slug: string, leadId: string | null): string {
  const lid = leadId ? `&lid=i-${encodeURIComponent(leadId)}` : "";
  const path = CLAIM_PATH.replace("{slug}", slug);
  return `${SITE_URL}${path}?src=lead${lid}`;
}

export function unsubscribeUrl(toEmail: string): string {
  // "u-" QP-hardening marker (stripped on read in /api/unsubscribe).
  return `${SITE_URL}/api/unsubscribe?email=u-${encodeURIComponent(toEmail)}&scope=pitch`;
}

// Full CASL-compliant claim-pitch email (subject/html/text/headers) for the bespoke
// Gmail sendEmail. Carries sender ID + physical address + visible unsubscribe + the
// List-Unsubscribe / List-Unsubscribe-Post headers.
export function buildClaimPitchEmail(args: {
  to: string;
  slug: string;
  businessName: string;
  inquirerName: string;
  inquirerEmail: string;
  inquirerPhone?: string;
  mortgageType?: string;
  message?: string;
  leadId: string | null;
}): { subject: string; html: string; text: string; headers: Record<string, string> } | null {
  const postalAddress = (process.env.CASL_POSTAL_ADDRESS || "").trim();
  if (!postalAddress) return null; // fail-closed: never emit a CEM without a physical address

  const cta = claimUrl(args.slug, args.leadId);
  const unsub = unsubscribeUrl(args.to);
  const subject = `New lead from ${DIRECTORY_NAME} — ${args.inquirerName}`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">New Lead from ${DIRECTORY_NAME}</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${DISPLAY_DOMAIN}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;font-size:15px;">Hi <strong>${args.businessName}</strong>, you have a new lead!</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:#6b7280;width:120px;vertical-align:top;">Name</td><td style="padding:8px 0;font-weight:600;">${args.inquirerName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Email</td><td style="padding:8px 0;"><a href="mailto:${args.inquirerEmail}" style="color:#1e3a5f;">${args.inquirerEmail}</a></td></tr>
      ${args.inquirerPhone ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Phone</td><td style="padding:8px 0;">${args.inquirerPhone}</td></tr>` : ""}
      ${args.mortgageType ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Mortgage type</td><td style="padding:8px 0;">${args.mortgageType}</td></tr>` : ""}
    </table>
    ${args.message ? `<div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid #1e3a5f;border-radius:4px;font-size:14px;line-height:1.5;">${args.message}</div>` : ""}
    <div style="margin:24px 0 0;padding:16px 20px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
      <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#92400e;">
        This customer found you through <strong>${DIRECTORY_NAME}</strong>, where you have a free listing.
        It's currently <strong>unclaimed</strong>, so leads like this aren't reaching you automatically.
      </p>
      <a href="${cta}" style="display:inline-block;padding:10px 20px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Claim your free listing (~30 sec) →</a>
      <p style="margin:10px 0 0;font-size:12px;color:#b45309;">Once claimed, future requests come straight to your inbox.</p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 12px;" />
    <p style="font-size:11px;color:#9ca3af;margin:0 0 6px;line-height:1.5;">This message was sent by ${CASL_SENDER}, operator of ${DIRECTORY_NAME} (${DISPLAY_DOMAIN}), because your business is listed in our public directory.</p>
    <p style="font-size:11px;color:#9ca3af;margin:0 0 6px;line-height:1.5;">${postalAddress}</p>
    <p style="font-size:11px;color:#9ca3af;margin:0;"><a href="${unsub}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a> &middot; you will receive no further claim emails at this address.</p>
  </div>
</div>`;

  const text = [
    `New lead from ${DIRECTORY_NAME} (${DISPLAY_DOMAIN})`,
    ``,
    `Name: ${args.inquirerName}`,
    `Email: ${args.inquirerEmail}`,
    args.inquirerPhone ? `Phone: ${args.inquirerPhone}` : "",
    args.mortgageType ? `Mortgage type: ${args.mortgageType}` : "",
    args.message ? `\nMessage:\n${args.message}` : "",
    ``,
    `— — —`,
    `This customer found you through ${DIRECTORY_NAME}, where you have a free listing.`,
    `It's currently unclaimed, so leads like this aren't reaching you automatically.`,
    `Claim it (free, ~30 sec): ${cta}`,
    ``,
    `— — —`,
    `Sent by ${CASL_SENDER}, operator of ${DIRECTORY_NAME} (${DISPLAY_DOMAIN}), because your business is listed in our public directory.`,
    postalAddress,
    `Unsubscribe: ${unsub}`,
  ].filter(Boolean).join("\n");

  const headers = {
    "List-Unsubscribe": `<${unsub}>, <mailto:${process.env.GMAIL_USER || "support@doineedamortgagebroker.com"}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return { subject, html, text, headers };
}
