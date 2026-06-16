"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Listing, Inquiry } from "@/types";

interface Stats {
  totalListings: number;
  claimedListings: number;
  totalInquiries: number;
  premiumListings: number;
}

interface InquiryWithListing extends Inquiry {
  listing?: { name: string; slug: string } | null;
}

interface AdminClientProps {
  stats: Stats;
  listings: Listing[];
  inquiries: InquiryWithListing[];
}

export default function AdminClient({
  stats,
  listings: initialListings,
  inquiries,
}: AdminClientProps) {
  const supabase = createClient();
  const router = useRouter();

  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"listings" | "inquiries">(
    "listings"
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const matchesSearch =
        search === "" ||
        listing.name.toLowerCase().includes(search.toLowerCase()) ||
        (listing.city?.toLowerCase() ?? "").includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || listing.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [listings, search, statusFilter]);

  async function updateStatus(id: string, status: string) {
    setLoadingId(id);
    const { error } = await supabase
      .from("mortgage_listings")
      .update({ status })
      .eq("id", id);

    if (!error) {
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status } : l))
      );
    }
    setLoadingId(null);
    router.refresh();
  }

  async function deleteListing(id: string) {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    setLoadingId(id);
    const { error } = await supabase
      .from("mortgage_listings")
      .delete()
      .eq("id", id);

    if (!error) {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }
    setLoadingId(null);
    router.refresh();
  }

  const statCards = [
    {
      label: "Total Listings",
      value: stats.totalListings,
      color: "bg-[#0f2a4a]",
    },
    {
      label: "Claimed",
      value: stats.claimedListings,
      color: "bg-teal-600",
    },
    {
      label: "Inquiries",
      value: stats.totalInquiries,
      color: "bg-[#1a3a5c]",
    },
    {
      label: "Premium",
      value: stats.premiumListings,
      color: "bg-teal-700",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`${card.color} text-white rounded-xl p-5 shadow-md`}
          >
            <p className="text-sm font-medium text-white/80">{card.label}</p>
            <p className="text-3xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("listings")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "listings"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Listings
        </button>
        <button
          onClick={() => setActiveTab("inquiries")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "inquiries"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Recent Inquiries
        </button>
      </div>

      {/* Listings Tab */}
      {activeTab === "listings" && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by name or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <p className="text-sm text-gray-500">
            Showing {filteredListings.length} of {listings.length} listings
          </p>

          {/* Listings Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">
                      City
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">
                      Claimed
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredListings.map((listing) => (
                    <tr
                      key={listing.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0f2a4a]">
                          {listing.name}
                        </div>
                        <div className="text-xs text-gray-400 sm:hidden">
                          {listing.city ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {listing.city ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            listing.status === "active"
                              ? "bg-green-100 text-green-800"
                              : listing.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {listing.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {listing.claimed ? (
                          <span className="text-teal-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {listing.status !== "active" && (
                            <button
                              onClick={() =>
                                updateStatus(listing.id, "active")
                              }
                              disabled={loadingId === listing.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
                            >
                              Activate
                            </button>
                          )}
                          {listing.status === "active" && (
                            <button
                              onClick={() =>
                                updateStatus(listing.id, "inactive")
                              }
                              disabled={loadingId === listing.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 transition-colors"
                            >
                              Deactivate
                            </button>
                          )}
                          <button
                            onClick={() => deleteListing(listing.id)}
                            disabled={loadingId === listing.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredListings.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        No listings found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inquiries Tab */}
      {activeTab === "inquiries" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">
                    Listing
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden lg:table-cell">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inquiries.map((inquiry) => (
                  <tr
                    key={inquiry.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0f2a4a]">
                        {inquiry.sender_name}
                      </div>
                      <div className="text-xs text-gray-400 sm:hidden">
                        {inquiry.sender_email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {inquiry.sender_email}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {inquiry.listing?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                        {inquiry.loan_type ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {inquiries.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No inquiries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
