"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/provinces";
import { canonical } from "@/lib/vertical-canonical";
import { HoursJson, ListingPhoto } from "@/lib/listing-extras";
import HelpDropdown from "@/components/owner-edit/HelpDropdown";
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
  gbp_url: string;
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
  onSaved,
  onCancel,
}: Props) {
  const router = useRouter();

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
    gbp_url: listing.gbp_url ?? "",
  });

  const [photos, setPhotos] = useState<ListingPhoto[]>(initialPhotos);
  const [logo, setLogo] = useState<ListingPhoto | null>(initialLogo);
  const [heroUrl, setHeroUrl] = useState<string | null>(listing.hero_image_url ?? null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const hasMoreDetails = !!form.hours_json || !!logo;
  const [moreOpen, setMoreOpen] = useState(hasMoreDetails);

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
      hours_json: form.hours_json,
      services: form.services,
      service_area: form.service_area,
      gbp_url: form.gbp_url ? normalizeUrl(form.gbp_url) : "",
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
        setTimeout(() => onSaved?.(), 800);
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
          <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
          <input type="text" value={form.short_description} onChange={(e) => update("short_description", e.target.value)}
            maxLength={160} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <small className="block text-xs text-gray-500 mt-1">{form.short_description.length} / 160</small>
        </div>
        <div id="description" className="scroll-mt-20">
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
          <textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
          <input type="text" value={form.website} onChange={(e) => update("website", e.target.value)}
            placeholder="www.example.com"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Province/State</label>
            <select value={form.province_state} onChange={(e) => update("province_state", e.target.value)}
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
      </section>

      {/* === High-leverage 4: photos, services, service area, GBP === */}
      <section className="space-y-6 border-t pt-6">
        <h2 className="text-lg font-semibold">Boost your listing</h2>

        <div id="photos" className="scroll-mt-20">
          <PhotoUploader
            slug={listing.slug}
            photos={photos}
            onUploaded={(p) => setPhotos((prev) => [...prev, p])}
            onDeleted={(id) => setPhotos((prev) => prev.filter((x) => x.id !== id))}
            max={photoLimitForTier(listing.tier || listing.subscription_tier)}
          />
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

        <div id="gbp" className="scroll-mt-20">
          <UrlInput
            label="Google Business Profile URL"
            value={form.gbp_url}
            onChange={(v) => update("gbp_url", v)}
            kind="gbp"
            helpSlot={
              <HelpDropdown label="Google Business Profile URL">
                <p><strong>What is this?</strong></p>
                <p>Your Google Business Profile is the listing that shows up when someone Googles your business — with the map, hours, reviews, and photos. It&apos;s free.</p>
                <p><strong>How to find yours</strong></p>
                <p>Search Google for your business name. If a panel appears on the right with a map, that&apos;s your profile. Click &ldquo;Own this business?&rdquo; to start claiming. If nothing appears, go to <a href="https://www.google.com/business" target="_blank" rel="noopener" className="text-blue-700 underline">google.com/business</a> to create one.</p>
                <p><strong>How to claim it</strong></p>
                <p>Google will verify by postcard, phone, or video. Takes 5-14 days. Once claimed, copy your profile&apos;s share URL (looks like g.page/YourBusiness or a maps.google.com link) and paste it here.</p>
                <p><strong>Why it matters</strong></p>
                <p>Claimed GBPs rank higher, get more clicks, and let you respond to reviews. It&apos;s the single highest-leverage free thing a local {canonical.noun} can do.</p>
              </HelpDropdown>
            }
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
            <HoursEditor
              value={form.hours_json}
              onChange={(v) => update("hours_json", v)}
            />

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
        <button type="button" onClick={() => onCancel?.()}
          className="px-6 py-2 border rounded-lg font-medium hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
