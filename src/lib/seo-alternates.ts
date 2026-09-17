// Per-path canonical + hreflang builder (TDL #1241, Site Surfer 2026-09-16 finding A1).
//
// The ROOT LAYOUT used to carry `alternates: { canonical: SITE_URL, languages:
// HREFLANG_ALTERNATES }`. In Next's App Router a page that does not override
// `alternates` INHERITS the layout's object verbatim, so every route that lacked its
// own block emitted `<link rel="canonical" href="https://<host>/">` — an affirmative
// instruction to Google that the listing page, the city hub and the profession hub are
// all duplicates of the homepage. The 2026-09-16 walk caught it on
// /listing/mark-ramirez-miami, /el-granada-ca and /el-granada-ca/construction.
//
// The layout no longer sets `alternates` at all (so a route added later cannot silently
// inherit a wrong canonical — it emits none, and Google self-canonicals by default).
// Every route states its own via this helper.
//
// Both `canonical` and each `languages` entry must be restated together: overriding
// `alternates` replaces the parent object WHOLESALE, so a page that sets only
// `canonical` silently drops the cross-host hreflang pair.
import { HREFLANG_ALTERNATES } from "@/lib/jurisdiction";

/**
 * @param path site-relative path, e.g. "/about" or "/listing/jane-doe-miami". "/" for
 *   the homepage. `canonical` is returned RELATIVE and resolved against the layout's
 *   metadataBase (lib/constants SITE_URL), so each of the two Vercel projects on this
 *   repo self-points at its own origin. `languages` must be absolute per host.
 */
export function selfAlternates(path: string) {
  const clean = path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const suffix = clean === "/" ? "" : clean;
  return {
    canonical: clean,
    languages: Object.fromEntries(
      Object.entries(HREFLANG_ALTERNATES).map(([lang, origin]) => [lang, `${origin}${suffix}`])
    ),
  };
}
