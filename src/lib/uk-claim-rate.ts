// TDL #1372 (stream10-held-identity-safety-v1-fixup): the D8 UK claim limiter, ported to the pre-D8 mortgagebroker
// UK route. Same RPC and shape as the 21 D8 repos (uk_claim_rate_check: 3/email/h, 10/email/day, 20/IP/h, sha256
// keys). FAIL-CLOSED: any limiter error or timeout returns allowed=false + error; the route refuses with 503 and
// raises the sentinel alert.
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const RATE_TIMEOUT_MS = 1500;

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : req.headers.get("x-real-ip") || "").trim();
  return ip || null;
}

export type UkClaimRateResult = { allowed: boolean; error?: string };

export async function checkUkClaimRate(email: unknown, req: NextRequest): Promise<UkClaimRateResult> {
  try {
    const emailHash = sha256(String(email).trim().toLowerCase());
    const ip = clientIp(req);
    const call = Promise.resolve(
      supabaseAdmin.rpc("uk_claim_rate_check", { p_email_hash: emailHash, p_ip_hash: ip ? sha256(ip) : null })
    );
    const res = await Promise.race([
      call,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("rate limiter timeout")), RATE_TIMEOUT_MS)),
    ]);
    if (res.error) return { allowed: false, error: res.error.message };
    if (typeof res.data !== "boolean") return { allowed: false, error: "rate limiter returned a non-boolean" };
    return { allowed: res.data };
  } catch (e) {
    return { allowed: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function alertUkClaimFailure(title: string, details: Record<string, unknown>) {
  try {
    const { error } = await supabaseAdmin.from("sentinel_alerts").insert({
      severity: "high",
      module: "uk-claim",
      repo: "doineedamortgagebroker",
      title,
      details,
      status: "open",
    });
    if (error) console.error(`[uk-claim] sentinel_alerts insert failed: ${error.message}`);
  } catch (e) {
    console.error(`[uk-claim] sentinel_alerts insert threw: ${e instanceof Error ? e.message : e}`);
  }
}
