"use client";

import { useState } from "react";
import { SITE_NAME } from "@/lib/constants";
import { canonical } from "@/lib/vertical-canonical";

export default function ClaimForm({
  listingSlug,
  listingName,
  src,
  lid,
}: {
  listingSlug: string;
  listingName: string;
  src?: string; // 'lead' when the claim came from a forwarded-lead pitch (TDL #472)
  lid?: string; // the mortgage_inquiries lead id the pitch was attached to
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: listingSlug, email, name, src, lid }),
      });
      let data: { success?: boolean; userMessage?: string; error?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (res.ok && data?.success) {
        setStatus("sent");
        return;
      }
      setErrorMsg(
        data?.userMessage ||
          data?.error ||
          "We couldn't submit your claim right now. Please try again in a moment."
      );
      setStatus("error");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <h3 className="text-green-800 font-semibold text-lg">Verification email sent!</h3>
        <p className="text-green-600 mt-2">Check your email and click the verification link to claim your listing.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold">Claim &ldquo;{listingName}&rdquo;</h2>
      <p className="text-gray-600 text-sm">
        Verify your ownership to manage this listing on {SITE_NAME}.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {status === "error" && <p className="text-red-600 text-sm">{errorMsg}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-2 rounded-lg text-white font-medium disabled:opacity-50"
        style={{ backgroundColor: canonical.primaryColor }}
      >
        {status === "sending" ? "Submitting..." : "Claim This Listing"}
      </button>
    </form>
  );
}
