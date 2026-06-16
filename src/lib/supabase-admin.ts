// Service-role Supabase singleton for server-side admin operations (photos,
// owner-token auth, listing_photos writes). Mirrors the canonical
// doineedanaccountant lib/supabase.ts `supabaseAdmin`. Distinct from
// src/lib/supabase/server.ts (per-request SSR/anon client) — this is a
// long-lived service-role client, never exposed to the browser.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, { ...options, cache: "no-store" });
    },
  },
});

// The vertical's listings table — single source for ported helpers/routes.
export const LISTINGS_TABLE = "mortgage_listings";
