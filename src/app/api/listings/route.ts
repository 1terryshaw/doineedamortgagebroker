import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

/**
 * PATCH /api/listings
 * Update a listing that the authenticated user owns.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { listing_id, name, bio, phone, email, website } =
      body;

    if (!listing_id) {
      return NextResponse.json(
        { error: "listing_id is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("mortgage_listings")
      .select("id, claimed_by")
      .eq("id", listing_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    if (existing.claimed_by !== user.id) {
      return NextResponse.json(
        { error: "You do not own this listing" },
        { status: 403 }
      );
    }

    // Update with service role to bypass RLS
    const serviceClient = await createServiceRoleClient();

    const { data: updated, error: updateError } = await serviceClient
      .from("mortgage_listings")
      .update({
        name,
        bio,
        phone,
        email,
        website,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update listing" },
        { status: 500 }
      );
    }

    return NextResponse.json({ listing: updated });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/listings
 * Claim an unclaimed listing for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { listing_id } = body;

    if (!listing_id) {
      return NextResponse.json(
        { error: "listing_id is required" },
        { status: 400 }
      );
    }

    // Use service role to check and claim atomically
    const serviceClient = await createServiceRoleClient();

    // Check that the listing exists and is unclaimed
    const { data: existing, error: fetchError } = await serviceClient
      .from("mortgage_listings")
      .select("id, claimed_by, name")
      .eq("id", listing_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    if (existing.claimed_by) {
      return NextResponse.json(
        { error: "This listing has already been claimed" },
        { status: 409 }
      );
    }

    // Claim the listing
    const { data: claimed, error: claimError } = await serviceClient
      .from("mortgage_listings")
      .update({
        claimed: true,
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing_id)
      .is("claimed_by", null) // Extra safety: only claim if still unclaimed
      .select()
      .single();

    if (claimError || !claimed) {
      return NextResponse.json(
        { error: "Failed to claim listing. It may have already been claimed." },
        { status: 409 }
      );
    }

    return NextResponse.json({ listing: claimed });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
