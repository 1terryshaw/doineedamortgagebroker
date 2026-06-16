// Hybrid owner-auth for the ported Boost routes (TDL Boost port, Option B).
//
// The canonical (doineedanaccountant) authenticates the owner via an
// owner-token cookie whose slug identifies the single listing. Mortgage keeps
// its existing Supabase Auth model instead: the logged-in user is resolved from
// the Supabase session, and ownership is verified against the listing's
// `claimed_by` column (a user may own several listings, so every request must
// name the listing it targets). Mirrors the post-#604 /api/listings pattern:
// anon SSR client for getUser(), service-role client for the data read/write.
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";

export async function getAuthedUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Returns the listing (selected columns) iff it exists AND is claimed by the
// authenticated user; otherwise null. `match` keys off slug or id.
async function getOwnedListing(
  match: { slug?: string; id?: string },
  select: string
): Promise<Record<string, unknown> | null> {
  const userId = await getAuthedUserId();
  if (!userId) return null;
  const key = match.slug ? "slug" : "id";
  const val = match.slug ?? match.id;
  if (!val) return null;

  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select(select)
    .eq(key, val)
    .eq("claimed_by", userId)
    .single();

  if (error || !data) return null;
  return data as unknown as Record<string, unknown>;
}

export function getOwnedListingBySlug(slug: string, select: string) {
  return getOwnedListing({ slug }, select);
}

export function getOwnedListingById(id: string, select: string) {
  return getOwnedListing({ id }, select);
}
