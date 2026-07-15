// Republish-on-claim guard — TDL #1068.
//
// A SEEDED person-listing that is CLAIMED (email-verified at claim/verify) is
// consented-to by its subject, so it should PUBLISH — this closes the republish
// gap where a claim wrote `claimed=true` but never `is_published`, leaving the
// owner's page at 410. But a personal claim does NOT cure a SOURCE-level
// redistribution bar, and a nameless row must never render.
//
//   guard a — only republish a row that is currently unpublished
//   guard c — a source-restriction / unmapped deserve_reason stays BLOCKED
//   guard d — the name must contain a letter (never publish a "." page)
//
// There is no guard b: these verticals have no self_serve rows (seeded only).
//
// FAIL-CLOSED (K39): ONLY the person-consent-curable reasons below — or a NULL
// marker, i.e. a never-de-served seed — publish. Every other value
// (RESTRICTED_SOURCE_TERMS, RESTRICTED_UNCLEAR, YP-prohibited, or anything
// unmapped) stays 410 BY DESIGN. Publishing a RESTRICTED row reopens the #1014
// source-terms exposure; a claim is consent from the PERSON, not the SOURCE.
export const CLAIM_CURES_DESERVE = new Set<string>([
  "person_seeded_licensing_roster",
  "PERSON_SEEDED_LIABILITY",
  "cross_vertical_person_survivor",
]);

export type RepublishInput = {
  is_published: boolean | null;
  deserve_reason: string | null;
  name: string | null;
};

/** True iff a claim legitimately republishes this row (all four guards clear). */
export function canRepublishOnClaim(l: RepublishInput): boolean {
  if (l.is_published !== false) return false; // guard a — not currently down
  if (l.deserve_reason !== null && !CLAIM_CURES_DESERVE.has(l.deserve_reason)) return false; // guard c
  if (!/[A-Za-z]/.test(l.name ?? "")) return false; // guard d — nameless never renders
  return true;
}
