import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AdminClient from "@/components/AdminClient";

export const metadata = {
  title: "Admin Dashboard | DoINeedAMortgageBroker",
  robots: { index: false, follow: false },
};

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
      .select("*", { count: "exact", head: true }),
    supabase
      .from("mortgage_listings")
      .select("*", { count: "exact", head: true })
      .eq("claimed", true),
    supabase
      .from("mortgage_inquiries")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("mortgage_listings")
      .select("*", { count: "exact", head: true })
      .eq("is_premium", true),
  ]);

  // Fetch all listings with region
  const { data: listings } = await supabase
    .from("mortgage_listings")
    .select("*, region:mortgage_regions(*)")
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
          listings={listings ?? []}
          inquiries={inquiries ?? []}
        />
      </div>
    </main>
  );
}
