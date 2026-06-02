# Mortgage Directory Consolidation — Progress

Survivor: **doineedamortgagebroker** (.com, US). CA front door: **findmymortgagebroker.ca**
(served today by the separate `findyourmortgagebroker` repo). Decision: **Option B** — one
codebase + one shared `mortgage_listings` table, env-gated (`NEXT_PUBLIC_COUNTRY`), deployed
twice; keep `.ca` alive with its native ccTLD canonical. NOT path-segmented (no `/us`,`/ca`).

## Recon (done)
- Both repos = same template (`.com` forked from the `.ca` repo 2026-05-14).
- DATA: single shared table `mortgage_listings` (31,658 active). **No `country` column** on
  `mortgage_listings` or `mortgage_regions` — country is derived from `province`. US = 25,224
  (Florida-only); CA = 6,434 (all 13 provinces). No data migration needed. ⚠️ US content gap:
  FL-only until more US states are seeded.
- `findyourmortgagebroker.ca` = NXDOMAIN (just the repo name); live CA host = `findmymortgagebroker.ca`.

## Phase 1 — additive country-aware layer ✅ DONE (2026-06-02) — NON-DESTRUCTIVE
- `src/lib/country.ts`: added `countryForProvince(province)` helper (province → CA/US).
- `src/lib/jurisdiction.ts` (new): COUNTRY-keyed content layer. **US values reproduce existing
  copy byte-for-byte** → live .com unchanged. Covers: regulator label (US=NMLS/state records;
  CA=provincial regulators FSRA/BCFSA — **never NMLS for CA**), reverse-mortgage min age (US 62 /
  CA 55), currency (USD/CAD), locale, verify-registry link, governing law (FL / Ontario), privacy
  law (CCPA / PIPEDA), hero/footer/disclaimer/search copy, country-segmented footer browse
  (US = FL cities; CA = province search links), and cross-host hreflang.
- Wired into: layout.tsx (title/desc/og-locale + additive hreflang `<link>`s; **canonical host
  untouched**), about/terms/privacy/contact pages, Disclaimer (site-wide), homepage (hero +
  JSON-LD + search placeholder), search page metadata.
- **NO routing changes, NO 301s, NO canonical host changes.**
- VALIDATION (real `next build && next start`, both modes):
  - **US**: every surface byte-preserved (hero, footer FL cities, NMLS, disclaimer, CCPA);
    canonical → .com; hreflang present. Zero regression.
  - **CA**: zero leaks (NMLS / "United States" / "state regulator" / FL cities = 0 on home,
    about, contact, terms, privacy); correct provincial/Canadian copy; canonical → .ca; hreflang.

## Phase 2 — gated cutover (PENDING — awaiting go)
Repoint `findmymortgagebroker.ca`'s Vercel project Git source to the **survivor** repo with
`NEXT_PUBLIC_COUNTRY=CA` and `NEXT_PUBLIC_SITE_URL=https://findmymortgagebroker.ca`; archive
(don't delete) the old `findyourmortgagebroker` repo. Keep `.ca` registered/renewed
(load-bearing — do NOT let it lapse, cf. Netfirms). No URL/301 changes needed under Option B
(env-gated, same paths). Rollback = revert the Vercel Git-source binding; `.ca` DNS untouched.
Per-page hreflang reciprocity completes automatically once both hosts run this repo.

## Phase 2 — cutover COMPLETE + verified (2026-06-02)
findmymortgagebroker.ca's Vercel Git source was rebound to this repo (by the project owner);
deploy triggered via empty commit `f71de95`. VERIFIED live: .ca (200) serves this codebase in
CA mode (Browse-by-Province, provincial regulator, NMLS/US/FL leaks = 0, canonical →
findmymortgagebroker.ca, reciprocal hreflang); `/api/unsubscribe` works on .ca + .com; URL-parity
holds (/toronto, /ottawa, /search, /search?province=ON all 200, no 404s); live .com US unchanged.
Rollback = revert the .ca Git-source binding. (Earlier blocker — .ca project not under this
account's Vercel scope — was resolved by the owner doing the rebind.)

### (historical) the pre-cutover prep this phase shipped
- MUST-FIX **already satisfied**: survivor has `/api/unsubscribe` (unified-suppression version
  via TDL#472 — `mortgage_listings` + `public.email_suppressions`). File-set diff confirms
  survivor ⊇ old `.ca` repo — **no routes to port**.
- Shipped country-conditional **email from-name** (`JURISDICTION.emailFromName`: US=
  `DoINeedAMortgageBroker` unchanged; CA=`FindMyMortgageBroker`) so post-cutover `.ca` won't
  send US-branded mail (commit `0a7e7e7`). NOTE: email is **Gmail SMTP** (shared empire account,
  `GMAIL_USER`), NOT per-domain Resend — so there is no per-domain Resend sender to configure;
  the from-name is the brand control.
- **BLOCKER:** `findmymortgagebroker.ca`'s Vercel project is **NOT under this account's scope**
  (1terryshaw-3369 / terence-shaws-projects — 20 projects, none is find*/mortgage-CA; `.ca` not
  in domains list). The **Git-source rebind, env-import, and repo-archive must be done by
  whoever owns that Vercel team** (likely a separate Vercel account/team). Steps below.

### Phase-2 cutover steps for the .ca Vercel-project owner (NOT executable from here)
1. ENV PARITY on the `.ca` project (it already runs a sibling, so most exist): confirm
   `NEXT_PUBLIC_COUNTRY=CA`, `NEXT_PUBLIC_SITE_URL=https://findmymortgagebroker.ca`,
   Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`), `GMAIL_USER` + `GMAIL_APP_PASSWORD`, `ANTHROPIC_API_KEY`,
   `GOOGLE_PLACES_API_KEY`, `ADMIN_EMAIL`. (Email = Gmail SMTP, shared — no Resend var needed.)
2. Repoint the `.ca` project's **Git source** → `1terryshaw/doineedamortgagebroker` (production
   branch `master`). Trigger a deploy.
3. Archive (don't delete) the `1terryshaw/findyourmortgagebroker` repo.
4. Keep `findmymortgagebroker.ca` registered/renewed; DNS untouched. Rollback = revert the
   Git-source binding.
5. VERIFY: `.ca` serves CA mode (provincial copy, NMLS=0, Ontario/PIPEDA, canonical→.ca,
   reciprocal hreflang), `/api/unsubscribe` responds, and URL-parity (no previously-live CA URL
   404s; `/[citySlug]`, `/[citySlug]/[professionSlug]`, `/listing/[slug]`, `/search` all stable).

## Open / later
- US content gap (FL-only) — seed more US states (FL OFR + other state boards).
- Unused `SITE_DESCRIPTION` in constants.ts still US-worded (dead constant; conditionalize if revived).
- Optional: derive footer/browse cities from live data instead of hardcoded lists.
