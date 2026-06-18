"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Lead {
  id: string;
  sender_name: string | null;
  sender_email: string | null;
  message: string | null;
  created_at: string;
  [key: string]: unknown;
}

// Owner portal leads list with the TDL #607 realtime hook preserved verbatim:
// channel "inquiries-realtime" on mortgage_inquiries INSERT, reading sender_name/
// sender_email (NOT name/email — the #607 column fix).
export default function OwnerLeads({
  listingId,
  initialLeads,
}: {
  listingId: string;
  initialLeads: Lead[];
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("inquiries-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mortgage_inquiries" },
        (payload) => {
          const newLead = payload.new as Lead & { listing_id?: string };
          if (newLead.listing_id === listingId) {
            setLeads((prev) => [newLead, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listingId]);

  if (leads.length === 0) {
    return <p className="text-gray-500 text-sm">No inquiries yet.</p>;
  }

  return (
    <div className="divide-y divide-gray-100 border rounded-lg">
      {leads.map((lead) => (
        <div key={lead.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-[#1B2A4A]">{lead.sender_name}</p>
            <p className="text-xs text-gray-400 shrink-0">
              {new Date(lead.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <p className="text-sm text-gray-500">{lead.sender_email}</p>
          {lead.message && (
            <p className="text-sm text-gray-600 mt-1">{lead.message}</p>
          )}
        </div>
      ))}
    </div>
  );
}
