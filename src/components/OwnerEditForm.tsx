"use client";
import GbpStatusCard from "@/components/owner-edit/GbpStatusCard";
import AddressFields from "@/components/owner-edit/AddressFields";
import type { OwnerGbpStatus } from "@/lib/owner-gbp-status";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/provinces";
import { canonical } from "@/lib/vertical-canonical";
import { HoursJson, ListingPhoto } from "@/lib/listing-extras";
import TagListInput from "@/components/owner-edit/TagListInput";
import UrlInput from "@/components/owner-edit/UrlInput";
import HoursEditor from "@/components/owner-edit/HoursEditor";
import PhotoUploader from "@/components/owner-edit/PhotoUploader";
import LogoUploader from "@/components/owner-edit/LogoUploader";
import { photoLimitForTier } from "@/lib/photo-limits";
import HeroUploader from "@/components/owner-edit/HeroUploader";
import { can } from "@/lib/tier-capabilities";

// Fields the form reads off the listing. mortgage_listings is bucket B2
// (name + province_state); the long description lives in `bio` (no
// `description` column — TDL #604). No year_established / social_* columns
// exist on mortgage_listings, so those donor fields are intentionally dropped.
export interface OwnerEditListing {
  id: string;
  slug: string;
  name: string;
  short_description?: string | null;
  bio?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  city?: string | null;
  province_state?: string | null;
  tier?: string | null;
  subscription_tier?: string | null;
  hero_image_url?: string | null;
  hours_json?: HoursJson | null;
  services?: string[] | null;
  service_area?: string[] | null;
  gbp_url?: string | null;
}

interface Props {
  listing: OwnerEditListing;
  initialPhotos: ListingPhoto[];
  initialLogo: ListingPhoto | null;
  /** claimant-edit-ux-stamp-v1: resolved server-side (R2); always false here (no show_address column). */
  addressEditable?: boolean;
  gbpStatus?: OwnerGbpStatus;
  gbpConnectHref?: string | null;
  // The dashboard owns edit state — these let the form live inline in
  // DashboardClient rather than redirect to a standalone /owner page.
  onSaved?: () => void;
  onCancel?: () => void;
}

interface FormState {
  name: string;
  short_description: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  province_state: string;
  hours_json: HoursJson | null;
  services: string[];
  service_area: string[];
  /** Owner-controlled public visibility of the street (migration 041). */
  show_address: boolean;
  /** claimant-edit-ux-stamp-v1 (R2) — sent only when addressEditable. */
  address: string;
  postal_code: string;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function OwnerEditForm({
  listing,
  initialPhotos,
  initialLogo,
  addressEditable = false,
  gbpStatus,
  gbpConnectHref = null,
  onSaved,
  onCancel,
}: Props) {
  const router = useRouter();
  // show_address is sent / rendered ONLY when this listing object actually carries the column
  // (the dashboard's inline copy of this form may be fed a narrower projection — sending a
  // default `false` from there would silently hide a street the owner never touched).
  const hasShowAddress = typeof (listing as { show_address?: unknown }).show_address === "boolean";

  const [form, setForm] = useState<FormState>({
    name: listing.name,
    short_description: listing.short_description || "",
    // mortgage stores the long description in `bio` (TDL #604).
    description: listing.bio || "",
    phone: listing.phone || "",
    email: listing.email || "",
    website: listing.website || "",
    city: listing.city || "",
    province_state: listing.province_state || "",
    hours_json: listing.hours_json ?? null,
    services: listing.services ?? [],
    service_area: listing.service_area ?? [],
    // `=== true` so a NULL/absent column reads unticked — the safe direction.
    show_address: (listing as { show_address?: boolean | null }).show_address === true,
    address: (listing as { address?: string | null }).address ?? "",
    postal_code: (listing as { postal_code?: string | null }).postal_code ?? "",
  });

  const [photos, setPhotos] = useState<ListingPhoto[]>(initialPhotos);
  const [logo, setLogo] = useState<ListingPhoto | null>(initialLogo);
  const [heroUrl, setHeroUrl] = useState<string | null>(listing.hero_image_url ?? null);
  // Hours are written only when the owner changed them in this session, so an untouched
  // save never rewrites (or invents days for) whatever shape is stored.
  const [hoursTouched, setHoursTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const hasMoreDetails = !!form.hours_json || !!logo;
  const [moreOpen, setMoreOpen] = useState(hasMoreDetails);

  // owner-next-step-card-canary-v1: the dashboard's "Your next step" card deep-links to a
  // field (#owner-phone, #owner-hours, ...). Hours sit in the collapsed section, so open it first.
  const [hashTarget, setHashTarget] = useState<string | null>(null);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    if (id === "owner-hours") setMoreOpen(true);
    setHashTarget(id);
  }, []);
  useEffect(() => {
    if (!hashTarget) return;
    const el = document.getElementById(hashTarget);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    if (el.matches("input, textarea, select")) el.focus({ preventScroll: true });
    setHashTarget(null); // once — later "more details" toggles must not re-scroll
    // owner-journey-friction-fix-v1: photos above the field load after this first scroll and push it
    // off-screen on a phone, so re-anchor while the layout settles unless the owner scrolls first.
    let userScrolled = false;
    const stop = () => { userScrolled = true; };
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchmove", stop, { once: true, passive: true });
    // No cleanup: setHashTarget(null) above re-runs this effect, which must not cancel the re-anchors.
    for (const ms of [200, 600, 1200, 2000]) {
      window.setTimeout(() => {
        if (userScrolled || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight * 0.6) el.scrollIntoView({ block: "start" });
      }, ms);
    }
  }, [hashTarget, moreOpen]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    // Wire format always uses canonical keys: "name" + "province_state" + the
    // long-description wire key "description". /api/owner/update maps these to
    // the real DB columns (name, province_state, bio) via lib/owner-form-bucket.
    const payload = {
      slug: listing.slug,
      name: form.name,
      short_description: form.short_description,
      description: form.description,
      phone: form.phone,
      email: form.email,
      website: form.website ? normalizeUrl(form.website) : "",
      city: form.city,
      province_state: form.province_state,
      ...(hoursTouched ? { hours_json: form.hours_json } : {}),
      services: form.services,
      service_area: form.service_area,
      ...(hasShowAddress ? { show_address: form.show_address } : {}),
      ...(addressEditable ? { address: form.address, postal_code: form.postal_code } : {}),
    };

    try {
      const res = await fetch("/api/owner/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setErrorMessage("");
        setStatus("saved");
        router.refresh();
        setTimeout(() => {
          // Standalone (owner portal) has no onSaved handler → return to the portal.
          if (onSaved) onSaved();
          else router.push(`/owner/${listing.slug}?saved=1`); // owner-journey-friction-fix-v1: dashboard confirms the save
        }, 800);
      } else {
        let msg = "Failed to save. Please try again.";
        try {
          const data = await res.json();
          if (data?.detail) msg = `Save failed: ${data.detail}`;
          else if (data?.error) msg = `Save failed: ${data.error}`;
        } catch {
          // body wasn't JSON — keep default message
        }
        setErrorMessage(msg);
        setStatus("error");
      }
    } catch {
      // Network/fetch failure — the request may have reached the server.
      // Don't claim "Failed to save" since the write may have actually landed.
      setErrorMessage(
        "Connection issue while saving. Your changes may have gone through — refresh the page to verify before retrying."
      );
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold">Edit: {form.name || listing.name}</h1>

      {gbpStatus && <GbpStatusCard status={gbpStatus} connectHref={gbpConnectHref} />}

      {status === "saved" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
          Saved!
        </div>
      )}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {errorMessage || "Failed to save. Please try again."}
        </div>
      )}

      {/* === Existing core fields === */}
      <section className="space-y-4">
        <div>
          <label htmlFor="owner-f-business-name" className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
          <input id="owner-f-business-name" type="text" required value={form.name} onChange={(e) => update("name", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="owner-f-short-description" className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
          <input id="owner-f-short-description" type="text" value={form.short_description} onChange={(e) => update("short_description", e.target.value)}
            maxLength={160} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <small className="block text-xs text-gray-500 mt-1">{form.short_description.length} / 160</small>
        </div>
        <div id="description" className="scroll-mt-20">
          <label htmlFor="owner-description" className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
          <textarea id="owner-description" rows={5} value={form.description} onChange={(e) => update("description", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="owner-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input id="owner-phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="owner-f-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="owner-f-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label htmlFor="owner-website" className="block text-sm font-medium text-gray-700 mb-1">Website</label>
          <input id="owner-website" type="text" value={form.website} onChange={(e) => update("website", e.target.value)}
            placeholder="www.example.com"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="owner-f-city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input id="owner-f-city" type="text" value={form.city} onChange={(e) => update("city", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="owner-f-province-state" className="block text-sm font-medium text-gray-700 mb-1">Province/State</label>
            <select id="owner-f-province-state" value={form.province_state} onChange={(e) => update("province_state", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Select region...</option>
              <optgroup label="🇺🇸 United States">
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </optgroup>
              <optgroup label="───────────" disabled />
              <optgroup label="🇨🇦 Canada">
                {CANADIAN_PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </optgroup>
            </select>
          </div>
        </div>
        {/* claimant-edit-ux-stamp-v1 (R2): street + postal (read-only on this site: no hide toggle). */}
        <AddressFields editable={addressEditable} address={form.address} postalCode={form.postal_code}
          country={String((listing as { country?: string | null }).country ?? "").toUpperCase()}
          onChange={(f, v) => update(f, v)} />
        {/* ADDRESS SHOW/HIDE (migration 041). The ONLY writer of `show_address`. */}
        {hasShowAddress && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <label htmlFor="show-address" className="flex items-start gap-3 cursor-pointer">
            <input
              id="show-address"
              type="checkbox"
              checked={form.show_address}
              onChange={(e) => update("show_address", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-medium text-gray-700">Show my business address publicly</span>
              <span className="mt-1 block text-sm text-gray-500">
                When this is on, your street address and postal code appear on your listing and in the
                structured data search engines read. When it is off, only your city and region are shown
                &mdash; useful if you work from home or visit clients.
              </span>
            </span>
          </label>
        </div>
        )}
      </section>

      {/* === High-leverage 4: photos, services, service area, GBP === */}
      <section className="space-y-6 border-t pt-6">
        <h2 className="text-lg font-semibold">Boost your listing</h2>

        <div id="photos" className="scroll-mt-20">
          <div id="owner-photos">
            <PhotoUploader
              slug={listing.slug}
              photos={photos}
              onUploaded={(p) => setPhotos((prev) => [...prev, p])}
              onDeleted={(id) => setPhotos((prev) => prev.filter((x) => x.id !== id))}
              max={photoLimitForTier(listing.tier || listing.subscription_tier)}
            />
          </div>
        </div>

        {can(listing.tier || listing.subscription_tier, "reviews_display") && (
          <HeroUploader slug={listing.slug} heroUrl={heroUrl} onChange={setHeroUrl} />
        )}

        <div id="services" className="scroll-mt-20">
          <TagListInput
            label="Services"
            value={form.services}
            onChange={(v) => update("services", v)}
            max={20}
            placeholder="First-time buyer, refinancing, HELOC, commercial mortgages, ..."
            hint="What you offer — comma-separated. Helps Google match you to specific searches."
          />
        </div>

        <div id="service-area" className="scroll-mt-20">
          <TagListInput
            label="Service area"
            value={form.service_area}
            onChange={(v) => update("service_area", v)}
            max={10}
            placeholder="Cities or regions where you take clients, ..."
            hint="Cities or regions where you take clients — comma-separated."
          />
        </div>

      </section>

      {/* === Progressive disclosure: extras === */}
      <section className="border-t pt-6">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          {moreOpen ? "− Hide additional details" : "+ Add more details"}
        </button>

        {moreOpen && (
          <div className="space-y-6 mt-4">
            <div id="owner-hours">
              <HoursEditor
                value={form.hours_json}
                onChange={(v) => {
                  setHoursTouched(true);
                  update("hours_json", v);
                }}
              />
            </div>

            <LogoUploader
              slug={listing.slug}
              logo={logo}
              onUploaded={(p) => setLogo(p)}
              onDeleted={() => setLogo(null)}
            />
          </div>
        )}
      </section>

      <div className="flex gap-4 border-t pt-6">
        <button type="submit" disabled={status === "saving"}
          className="px-6 py-2 rounded-lg text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: canonical.primaryColor }}>
          {status === "saving" ? "Saving..." : "Save Changes"}
        </button>
        <button type="button" onClick={() => { if (onCancel) onCancel(); else router.push(`/owner/${listing.slug}`); }}
          className="px-6 py-2 border rounded-lg font-medium hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
