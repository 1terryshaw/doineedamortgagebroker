import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";

export const metadata = {
  title: "Dashboard | Find Your Mortgage Broker",
  description: "Manage your mortgage broker listing and inquiries.",
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's claimed listings
  const { data: listings } = await supabase
    .from("mortgage_listings")
    .select("*")
    .eq("claimed_by", user.id)
    .order("created_at", { ascending: false });

  // Fetch recent inquiries for the user's listings
  const listingIds = (listings ?? []).map((l) => l.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inquiries: any[] = [];
  if (listingIds.length > 0) {
    const { data: inquiryData } = await supabase
      .from("mortgage_inquiries")
      .select("*")
      .in("listing_id", listingIds)
      .order("created_at", { ascending: false })
      .limit(50);

    inquiries = inquiryData ?? [];
  }

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Top Nav */}
      <header className="bg-navy-900 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="text-xl font-bold text-white">
              Find Your <span className="text-teal-400">Mortgage Broker</span>
            </a>
            <div className="flex items-center gap-4">
              <span className="text-navy-300 text-sm hidden sm:block">
                {user.email}
              </span>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="text-sm text-navy-300 hover:text-white transition"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-6">
          Dashboard
        </h1>

        <DashboardClient
          user={{
            id: user.id,
            email: user.email ?? "",
          }}
          listings={listings ?? []}
          inquiries={inquiries}
        />
      </main>
    </div>
  );
}
