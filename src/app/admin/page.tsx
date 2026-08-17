import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SITE_NAME } from "@/lib/constants";
import AdminClient from "@/components/AdminClient";
import type { Listing } from "@/types";

export const metadata = {
  title: `Admin Dashboard | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

// 🔴 EXPLICIT PROJECTION — NEVER `select("*")` ON `mortgage_listings` HERE.
//
// createServerSupabaseClient() is the ANON key plus the caller's cookie session,
// so these queries execute as role `authenticated` for a signed-in admin — NOT as
// service_role. `authenticated` holds column-level SELECT on a subset of
// mortgage_listings (the token columns are revoked), and under a column-scoped
// grant PostgREST answers `select=*` with 42501. Verified by rehearsal: both
// `SELECT *` AND `count(*)` over a `select("*")` subquery raise
// "permission denied for table mortgage_listings" — which is why the head:true
// counts below project `id` rather than `*`. The failure mode is a silently EMPTY
// admin dashboard, not an error page (TDL #1203).
//
// Token/secret columns are excluded by omission (default-deny):
// owner_auth_token, outreach_unsub_token, owner_auth_token_expires_at.
// NOTE: `status` and `state` are NOT columns on this table — do not add them.
const ADMIN_LISTING_COLS =
  "id, name, slug, city, province, email, phone, website, claimed, claimed_by, " +
  "is_active, is_premium, listing_type, subscription_tier, region_id, created_at";

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/");
  }

  // Fetch stats
  const [
    { count: totalListings },
    { count: claimedListings },
    { count: totalInquiries },
    { count: premiumListings },
  ] = await Promise.all([
    supabase
      .from("mortgage_listings")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("mortgage_listings")
      .select("id", { count: "exact", head: true })
      .eq("claimed", true),
    supabase
      .from("mortgage_inquiries")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("mortgage_listings")
      .select("id", { count: "exact", head: true })
      .eq("is_premium", true),
  ]);

  // Fetch all listings with region
  const { data: listings } = await supabase
    .from("mortgage_listings")
    .select(`${ADMIN_LISTING_COLS}, region:mortgage_regions(*)`)
    .order("created_at", { ascending: false });

  // Fetch recent inquiries
  const { data: inquiries } = await supabase
    .from("mortgage_inquiries")
    .select("*, listing:mortgage_listings(name, slug)")
    .order("created_at", { ascending: false })
    .limit(20);

  const stats = {
    totalListings: totalListings ?? 0,
    claimedListings: claimedListings ?? 0,
    totalInquiries: totalInquiries ?? 0,
    premiumListings: premiumListings ?? 0,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-[#0f2a4a] text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-1 text-teal-300 text-sm">
            Logged in as {user.email}
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminClient
          stats={stats}
          // Cast through `unknown`: ADMIN_LISTING_COLS is a strict SUBSET of the
          // Listing interface. select("*") inferred `any` and type-checked
          // trivially; a named projection infers a precise row type that does not
          // satisfy Listing. AdminClient only reads id/name/city/claimed.
          listings={(listings as unknown as Listing[]) ?? []}
          inquiries={inquiries ?? []}
        />
      </div>
    </main>
  );
}
