import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";
import { getOwnedListingBySlug } from "@/lib/owner-auth";
import { sanitizeExtras, EXTRA_UPDATE_FIELDS } from "@/lib/listing-extras";
import { BUCKET } from "@/lib/owner-form-bucket";

export const dynamic = "force-dynamic";

// Wire-format keys the form sends. The route maps "name" + "province_state"
// onto the bucket-specific DB columns via lib/owner-form-bucket, and the
// long-description wire key "description" onto mortgage's real `bio` column
// (mortgage_listings has no `description` column — see TDL #604).
const PASSTHROUGH_FIELDS = [
  "short_description",
  "phone",
  "email",
  "website",
  "city",
] as const;

// Wire key -> actual DB column for fields whose names differ from the wire.
const REMAPPED_FIELDS: Record<string, string> = {
  description: "bio",
};

// Accept https://x, http://x, www.x, x — store canonical https://… form.
// Empty string explicitly clears the field.
function normalizeWebsite(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, ...updates } = body;

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing listing slug" }, { status: 400 });
  }

  // Supabase Auth + claimed_by ownership (hybrid model — see lib/owner-auth).
  const listing = await getOwnedListingBySlug(slug, "id");
  if (!listing) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safeUpdates: Record<string, unknown> = {};

  for (const field of PASSTHROUGH_FIELDS) {
    if (field in updates && typeof updates[field] === "string") {
      safeUpdates[field] =
        field === "website" ? normalizeWebsite(updates[field]) : updates[field];
    }
  }

  // Wire keys that map onto a differently-named DB column (e.g. description -> bio).
  for (const [wireKey, dbColumn] of Object.entries(REMAPPED_FIELDS)) {
    if (wireKey in updates && typeof updates[wireKey] === "string") {
      safeUpdates[dbColumn] = updates[wireKey];
    }
  }

  // Bucket-mapped fields. Form always sends "name" + "province_state";
  // we write to the actual DB columns for this repo's bucket.
  if ("name" in updates && typeof updates.name === "string") {
    safeUpdates[BUCKET.nameColumn] = updates.name;
  }
  if ("province_state" in updates && typeof updates.province_state === "string") {
    safeUpdates[BUCKET.provinceColumn] = updates.province_state;
  }

  const extrasInput: Record<string, unknown> = {};
  for (const k of EXTRA_UPDATE_FIELDS) {
    if (k in updates) extrasInput[k] = updates[k];
  }
  Object.assign(safeUpdates, sanitizeExtras(extrasInput));

  safeUpdates.updated_at = new Date().toISOString();
  safeUpdates.owner_last_action_at = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update(safeUpdates)
    .eq("id", listing.id as string);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update", detail: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
