// src/lib/suppression.ts — TDL #472 (mortgagebroker bespoke port).
// Shares the empire-wide central list public.email_suppressions (same table #472 +
// Campaign 1 read). Adapted to the bespoke createServiceRoleClient.

import { createServiceRoleClient } from "@/lib/supabase/server";

// True if the address is suppressed. Fail-closed (return true) on error so an infra
// blip can never cause a non-consensual CEM; the caller gates ONLY the pitch on this.
export async function isSuppressed(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const norm = email.trim().toLowerCase();
  if (!norm) return false;
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from("email_suppressions")
      .select("email_normalized")
      .eq("email_normalized", norm)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("isSuppressed error:", error.message);
      return true; // fail-closed
    }
    return !!data;
  } catch (err) {
    console.error("isSuppressed exception:", err instanceof Error ? err.message : err);
    return true; // fail-closed
  }
}

// Idempotent insert into the central suppression list (the unsubscribe target).
export async function suppressEmail(
  email: string,
  reason = "claim_pitch_unsubscribe",
  source = "claim_pitch_one_click",
): Promise<{ ok: boolean; error?: string }> {
  const clean = (email || "").trim();
  if (!clean) return { ok: false, error: "empty_email" };
  const supabase = await createServiceRoleClient();
  const { error } = await supabase
    .from("email_suppressions")
    .insert({ email: clean, reason, source });
  if (error && !/duplicate key|already exists|unique|23505/i.test(error.message)) {
    console.error("suppressEmail error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
