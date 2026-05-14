"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Listing {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  claimed_by: string | null;
  [key: string]: unknown;
}

interface Inquiry {
  id: string;
  listing_id: string;
  name: string;
  email: string;
  message: string | null;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

interface DashboardClientProps {
  user: { id: string; email: string };
  listings: Listing[];
  inquiries: Inquiry[];
}

export default function DashboardClient({
  user,
  listings: initialListings,
  inquiries: initialInquiries,
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"listings" | "inquiries">(
    "listings"
  );
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [inquiries, setInquiries] =
    useState<Inquiry[]>(initialInquiries);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Claim listing state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Listing[]>([]);
  const [searching, setSearching] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  // Real-time subscription for inquiries
  useEffect(() => {
    if (listings.length === 0) return;

    const supabase = createClient();
    const listingIds = listings.map((l) => l.id);

    const channel = supabase
      .channel("inquiries-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inquiries",
        },
        (payload) => {
          const newInquiry = payload.new as Inquiry;
          if (listingIds.includes(newInquiry.listing_id)) {
            setInquiries((prev) => [newInquiry, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listings]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("mortgage_listings")
        .select("*")
        .is("claimed_by", null)
        .ilike("name", `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data ?? []);
    } catch {
      setSaveMessage("Error searching listings. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleClaim = async (listingId: string) => {
    setClaiming(listingId);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });

      const result = await res.json();

      if (!res.ok) {
        setSaveMessage(result.error || "Failed to claim listing.");
        return;
      }

      // Add the claimed listing to local state
      setListings((prev) => [result.listing, ...prev]);
      setSearchResults((prev) => prev.filter((l) => l.id !== listingId));
      setSaveMessage("Listing claimed successfully!");
      setSearchQuery("");
    } catch {
      setSaveMessage("An error occurred. Please try again.");
    } finally {
      setClaiming(null);
    }
  };

  const handleEditSave = async () => {
    if (!editingListing) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: editingListing.id,
          name: editingListing.name,
          description: editingListing.description,
          phone: editingListing.phone,
          email: editingListing.email,
          website: editingListing.website,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setSaveMessage(result.error || "Failed to update listing.");
        return;
      }

      setListings((prev) =>
        prev.map((l) => (l.id === editingListing.id ? result.listing : l))
      );
      setEditingListing(null);
      setSaveMessage("Listing updated successfully!");
    } catch {
      setSaveMessage("An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const hasListings = listings.length > 0;

  return (
    <div>
      {/* Status Message */}
      {saveMessage && (
        <div
          className={`mb-6 p-4 rounded-lg text-sm font-medium ${
            saveMessage.includes("success") || saveMessage.includes("Success")
              ? "bg-teal-50 border border-teal-200 text-teal-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {saveMessage}
          <button
            onClick={() => setSaveMessage(null)}
            className="ml-3 text-sm underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {!hasListings ? (
        /* ========== No Listings - Claim Flow ========== */
        <div className="bg-white rounded-2xl shadow-sm border border-navy-100 p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 mb-4">
              <svg
                className="w-8 h-8 text-teal-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-navy-900">
              Claim Your Listing
            </h2>
            <p className="mt-2 text-navy-500 max-w-md mx-auto">
              Search for your brokerage below to claim and manage your listing.
              Once claimed, you can edit your information and respond to
              inquiries.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by brokerage name..."
                className="flex-1 px-4 py-3 rounded-lg border border-navy-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-navy-900 placeholder:text-navy-400"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 text-white font-semibold rounded-lg transition"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-navy-500 font-medium">
                  {searchResults.length} listing
                  {searchResults.length !== 1 ? "s" : ""} found
                </p>
                {searchResults.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between p-4 bg-navy-50 rounded-xl border border-navy-100"
                  >
                    <div>
                      <h3 className="font-semibold text-navy-900">
                        {listing.name}
                      </h3>
                      <p className="text-sm text-navy-500">
                        {[listing.city, listing.state]
                          .filter(Boolean)
                          .join(", ") || "No location listed"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleClaim(listing.id)}
                      disabled={claiming === listing.id}
                      className="px-4 py-2 bg-navy-800 hover:bg-navy-900 disabled:bg-navy-600/50 text-white text-sm font-semibold rounded-lg transition"
                    >
                      {claiming === listing.id ? "Claiming..." : "Claim"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 &&
              searchQuery.trim() &&
              !searching && (
                <p className="mt-4 text-center text-navy-400 text-sm">
                  No unclaimed listings found matching your search. Try a
                  different search term.
                </p>
              )}
          </div>
        </div>
      ) : (
        /* ========== Has Listings - Tabs ========== */
        <>
          {/* Tab Bar */}
          <div className="flex gap-1 bg-navy-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => setActiveTab("listings")}
              className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition ${
                activeTab === "listings"
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-navy-500 hover:text-navy-700"
              }`}
            >
              My Listings ({listings.length})
            </button>
            <button
              onClick={() => setActiveTab("inquiries")}
              className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition ${
                activeTab === "inquiries"
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-navy-500 hover:text-navy-700"
              }`}
            >
              Inquiries ({inquiries.length})
            </button>
          </div>

          {/* My Listings Tab */}
          {activeTab === "listings" && (
            <div className="space-y-4">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-white rounded-2xl shadow-sm border border-navy-100 p-6"
                >
                  {editingListing?.id === listing.id ? (
                    /* Editing Form */
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-navy-900 mb-4">
                        Edit Listing
                      </h3>

                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-1">
                          Business Name
                        </label>
                        <input
                          type="text"
                          value={editingListing.name}
                          onChange={(e) =>
                            setEditingListing({
                              ...editingListing,
                              name: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-navy-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-1">
                          Description
                        </label>
                        <textarea
                          rows={3}
                          value={editingListing.description ?? ""}
                          onChange={(e) =>
                            setEditingListing({
                              ...editingListing,
                              description: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-navy-900 resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-navy-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={editingListing.phone ?? ""}
                            onChange={(e) =>
                              setEditingListing({
                                ...editingListing,
                                phone: e.target.value,
                              })
                            }
                            className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-navy-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-navy-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editingListing.email ?? ""}
                            onChange={(e) =>
                              setEditingListing({
                                ...editingListing,
                                email: e.target.value,
                              })
                            }
                            className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-navy-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-1">
                          Website
                        </label>
                        <input
                          type="url"
                          value={editingListing.website ?? ""}
                          onChange={(e) =>
                            setEditingListing({
                              ...editingListing,
                              website: e.target.value,
                            })
                          }
                          placeholder="https://example.com"
                          className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-navy-900 placeholder:text-navy-400"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleEditSave}
                          disabled={saving}
                          className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 text-white font-semibold rounded-lg transition"
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          onClick={() => setEditingListing(null)}
                          className="px-6 py-2.5 bg-navy-100 hover:bg-navy-200 text-navy-700 font-semibold rounded-lg transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Listing Display */
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-navy-900">
                          {listing.name}
                        </h3>
                        {listing.description && (
                          <p className="mt-1 text-navy-600 text-sm line-clamp-2">
                            {listing.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy-500">
                          {listing.phone && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              {listing.phone}
                            </span>
                          )}
                          {listing.email && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              {listing.email}
                            </span>
                          )}
                          {listing.website && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                />
                              </svg>
                              {listing.website}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingListing({ ...listing })}
                        className="shrink-0 px-5 py-2.5 bg-navy-800 hover:bg-navy-900 text-white text-sm font-semibold rounded-lg transition"
                      >
                        Edit Listing
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Claim Additional Listing */}
              <div className="bg-white rounded-2xl shadow-sm border border-navy-100 p-6">
                <h3 className="text-lg font-bold text-navy-900 mb-3">
                  Claim Another Listing
                </h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search by brokerage name..."
                    className="flex-1 px-4 py-3 rounded-lg border border-navy-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-navy-900 placeholder:text-navy-400"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 text-white font-semibold rounded-lg transition"
                  >
                    {searching ? "..." : "Search"}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {searchResults.map((listing) => (
                      <div
                        key={listing.id}
                        className="flex items-center justify-between p-4 bg-navy-50 rounded-xl border border-navy-100"
                      >
                        <div>
                          <h4 className="font-semibold text-navy-900">
                            {listing.name}
                          </h4>
                          <p className="text-sm text-navy-500">
                            {[listing.city, listing.state]
                              .filter(Boolean)
                              .join(", ") || "No location listed"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleClaim(listing.id)}
                          disabled={claiming === listing.id}
                          className="px-4 py-2 bg-navy-800 hover:bg-navy-900 disabled:bg-navy-600/50 text-white text-sm font-semibold rounded-lg transition"
                        >
                          {claiming === listing.id ? "Claiming..." : "Claim"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inquiries Tab */}
          {activeTab === "inquiries" && (
            <div className="bg-white rounded-2xl shadow-sm border border-navy-100 overflow-hidden">
              {inquiries.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-navy-50 mb-4">
                    <svg
                      className="w-8 h-8 text-navy-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-navy-900">
                    No inquiries yet
                  </h3>
                  <p className="mt-1 text-navy-500 text-sm">
                    When potential clients contact you through your listing,
                    their inquiries will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-navy-100">
                  {/* Table Header - hidden on mobile */}
                  <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-navy-50 text-xs font-semibold text-navy-500 uppercase tracking-wider">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-3">Date</div>
                    <div className="col-span-3">Status</div>
                  </div>

                  {inquiries.map((inquiry) => (
                    <div
                      key={inquiry.id}
                      className="px-6 py-4 hover:bg-navy-50/50 transition"
                    >
                      {/* Mobile layout */}
                      <div className="sm:hidden space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-navy-900">
                              {inquiry.name}
                            </p>
                            <p className="text-sm text-navy-500">
                              {inquiry.email}
                            </p>
                          </div>
                          <InquiryStatusBadge status={inquiry.status} />
                        </div>
                        <p className="text-xs text-navy-400">
                          {new Date(inquiry.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </p>
                        {inquiry.message && (
                          <p className="text-sm text-navy-600 line-clamp-2">
                            {inquiry.message}
                          </p>
                        )}
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden sm:grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-3">
                          <p className="font-semibold text-navy-900 truncate">
                            {inquiry.name}
                          </p>
                        </div>
                        <div className="col-span-3">
                          <p className="text-sm text-navy-600 truncate">
                            {inquiry.email}
                          </p>
                        </div>
                        <div className="col-span-3">
                          <p className="text-sm text-navy-500">
                            {new Date(inquiry.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </p>
                        </div>
                        <div className="col-span-3">
                          <InquiryStatusBadge status={inquiry.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InquiryStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-teal-50 text-teal-700 border-teal-200",
    read: "bg-navy-50 text-navy-600 border-navy-200",
    replied: "bg-green-50 text-green-700 border-green-200",
    archived: "bg-gray-50 text-gray-500 border-gray-200",
  };

  const style = styles[status] ?? styles.new;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
