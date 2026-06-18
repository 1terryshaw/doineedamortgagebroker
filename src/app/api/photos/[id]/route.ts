import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase-admin";
import { getAuthFromCookies } from "@/lib/auth";
import {
  PHOTO_BUCKET,
  VERTICAL_KEY,
  compactPhotoOrder,
} from "@/lib/listing-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Owner-token cookie auth (TDL #624): resolve the cookie's listing, then
  // confirm the photo belongs to it.
  const auth = getAuthFromCookies(await cookies());
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: listing } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .single();
  if (!listing) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: photo, error: fetchError } = await supabaseAdmin
    .from("listing_photos")
    .select("id, storage_path, listing_id, photo_kind, vertical")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (photo.vertical !== VERTICAL_KEY || photo.listing_id !== listing.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: softErr } = await supabaseAdmin
    .from("listing_photos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", photo.id);
  if (softErr) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);

  if (photo.photo_kind === "photo") {
    await compactPhotoOrder(listing.id as string);
  }

  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ owner_last_action_at: new Date().toISOString() })
    .eq("id", listing.id as string);

  return NextResponse.json({ ok: true });
}
