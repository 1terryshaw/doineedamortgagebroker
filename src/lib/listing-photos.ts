// Server-side helpers for the shared listing_photos table + storage bucket.
// Both kinds (photo, logo) share the same table; the photo_kind column
// distinguishes them. App-layer enforces max-3 photos and max-1 logo via
// nextPhotoSlot() / existingLogoId() — DB also has chk_display_order(0..2).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { ListingPhoto, MAX_PHOTOS } from "@/lib/listing-extras";
import { VERTICAL_KEY } from "@/lib/vertical-canonical";

export const PHOTO_BUCKET = "listing-photos";
export { VERTICAL_KEY };

export type PhotoKind = "photo" | "logo";

interface PhotoRow {
  id: string;
  public_url: string;
  display_order: number;
  photo_kind: PhotoKind;
  storage_path: string;
}

export async function listPhotosForListing(listingId: string): Promise<{
  photos: ListingPhoto[];
  logo: ListingPhoto | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("listing_photos")
    .select("id, public_url, display_order, photo_kind, storage_path")
    .eq("vertical", VERTICAL_KEY)
    .eq("listing_id", listingId)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  if (error || !data) return { photos: [], logo: null };

  const photos: ListingPhoto[] = [];
  let logo: ListingPhoto | null = null;
  for (const r of data as PhotoRow[]) {
    const item: ListingPhoto = {
      id: r.id,
      public_url: r.public_url,
      display_order: r.display_order,
      photo_kind: r.photo_kind,
    };
    if (r.photo_kind === "logo") {
      if (!logo) logo = item;
    } else {
      photos.push(item);
    }
  }
  return { photos, logo };
}

export async function nextPhotoSlot(
  listingId: string,
  limit: number = MAX_PHOTOS
): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("listing_photos")
    .select("display_order")
    .eq("vertical", VERTICAL_KEY)
    .eq("listing_id", listingId)
    .eq("photo_kind", "photo")
    .is("deleted_at", null)
    .order("display_order", { ascending: true });
  if (error) return null;
  const used = new Set((data ?? []).map((r) => r.display_order));
  for (let i = 0; i < limit; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}

export async function existingLogoId(listingId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("listing_photos")
    .select("id")
    .eq("vertical", VERTICAL_KEY)
    .eq("listing_id", listingId)
    .eq("photo_kind", "logo")
    .is("deleted_at", null)
    .limit(1);
  return data?.[0]?.id ?? null;
}

export function buildStoragePath(listingId: string, kind: PhotoKind, uuid: string): string {
  return `${VERTICAL_KEY}/${listingId}/${kind}/${uuid}.webp`;
}

export function publicUrlFor(storagePath: string): string {
  const { data } = supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// After deleting a photo, compact display_order so the first remaining photo is hero.
export async function compactPhotoOrder(listingId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("listing_photos")
    .select("id, display_order")
    .eq("vertical", VERTICAL_KEY)
    .eq("listing_id", listingId)
    .eq("photo_kind", "photo")
    .is("deleted_at", null)
    .order("display_order", { ascending: true });
  if (!data) return;
  for (let i = 0; i < data.length; i++) {
    if (data[i].display_order !== i) {
      await supabaseAdmin
        .from("listing_photos")
        .update({ display_order: i })
        .eq("id", data[i].id);
    }
  }
}

// Batched media for list/card views: ONE query for many listings (no per-card
// waterfall). Returns the hero photo (kind='photo', display_order 0) and the
// logo public_url per listing_id.
export async function getCardMediaForListings(
  listingIds: string[]
): Promise<Map<string, { heroUrl: string | null; logoUrl: string | null }>> {
  const map = new Map<string, { heroUrl: string | null; logoUrl: string | null }>();
  if (listingIds.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("listing_photos")
    .select("listing_id, public_url, display_order, photo_kind")
    .eq("vertical", VERTICAL_KEY)
    .in("listing_id", listingIds)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  for (const r of (data ?? []) as Array<{
    listing_id: string;
    public_url: string;
    display_order: number;
    photo_kind: PhotoKind;
  }>) {
    const cur = map.get(r.listing_id) ?? { heroUrl: null, logoUrl: null };
    if (r.photo_kind === "logo") {
      if (!cur.logoUrl) cur.logoUrl = r.public_url;
    } else if (cur.heroUrl === null) {
      // ASC order → the first 'photo' row is display_order 0 (the hero).
      cur.heroUrl = r.public_url;
    }
    map.set(r.listing_id, cur);
  }
  return map;
}
