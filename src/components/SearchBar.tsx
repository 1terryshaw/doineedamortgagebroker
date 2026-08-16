"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DirectoryRegion } from "@/lib/directory-hub";

type Specialization = {
  slug: string;
  name: string;
  icon?: string | null;
};

type UkCounty = {
  slug: string;
  name: string;
  count: number;
};

type UkTown = {
  countySlug: string;
  slug: string;
  name: string;
};

type Props = {
  regions: DirectoryRegion[];
  specializations: Specialization[];
  ukCounties: UkCounty[];
  ukTowns: UkTown[];
};

const UK_PREFIX = "uk:";

export default function SearchBar({
  regions,
  specializations,
  ukCounties,
  ukTowns,
}: Props) {
  const sp = useSearchParams();
  const router = useRouter();

  const [region, setRegion] = useState(sp.get("region") ?? "");
  const [citySlug, setCitySlug] = useState(sp.get("city") ?? "");
  const [specSlug, setSpecSlug] = useState(sp.get("type") ?? "");
  const [query, setQuery] = useState(sp.get("q") ?? "");

  const selectedUkCounty = region.startsWith(UK_PREFIX)
    ? region.slice(UK_PREFIX.length)
    : null;
  const selectedRegion = regions.find((r) => r.province === region);
  const cities = selectedUkCounty
    ? ukTowns
        .filter((town) => town.countySlug === selectedUkCounty)
        .map((town) => ({ city: town.name, city_slug: town.slug, count: 0 }))
    : (selectedRegion?.cities ?? []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (region.startsWith(UK_PREFIX)) {
      const countySlug = region.slice(UK_PREFIX.length);
      router.push(
        citySlug ? `/uk/${countySlug}/${citySlug}` : `/uk/${countySlug}`
      );
      return;
    }
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (citySlug) params.set("city", citySlug);
    if (specSlug) params.set("type", specSlug);
    if (query.trim()) params.set("q", query.trim());
    // page resets to 1 on new search (omit)
    const qs = params.toString();
    router.push(`/directory${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-5"
    >
      <select
        value={region}
        onChange={(e) => {
          setRegion(e.target.value);
          setCitySlug("");
        }}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        aria-label="Province"
      >
        <option value="">All provinces</option>
        {regions.map((r) => (
          <option key={r.province} value={r.province}>
            {r.name}
          </option>
        ))}
        {ukCounties.length > 0 && (
          <optgroup label="United Kingdom">
            {ukCounties.map((county) => (
              <option key={county.slug} value={`${UK_PREFIX}${county.slug}`}>
                {county.name} ({county.count})
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <select
        value={citySlug}
        onChange={(e) => setCitySlug(e.target.value)}
        disabled={!region}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        aria-label="City"
      >
        <option value="">{region ? "All cities" : "Select province first"}</option>
        {cities.map((c) => (
          <option key={c.city_slug} value={c.city_slug}>
            {c.city}
          </option>
        ))}
      </select>

      {specializations.length > 0 && (
        <select
          value={specSlug}
          onChange={(e) => setSpecSlug(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          aria-label="Specialization"
        >
          <option value="">All specializations</option>
          {specializations.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Name…"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        aria-label="Name search"
      />

      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  );
}
