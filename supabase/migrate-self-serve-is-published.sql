-- ============================================================================
-- Self-Serve "Add My Business" — Phase 0 schema migration (is_published ONLY)
-- Table: public.mortgage_listings  (id = uuid; name family, NOT business_name)
-- Vertical: mortgage / findmymortgagebroker.ca
--   Repos sharing this table: doineedamortgagebroker + findyourmortgagebroker
--   (both src/app scaffold — see TDL #655 mortgage-bespoke-port sub-ticket).
-- TDL: #655 Phase 0  (pilot pattern from getapro-v2 migrate-self-serve-add-business.sql)
-- Date: 2026-06-22
--
-- WHY THIS EXISTS: mortgage_listings is one of only 4 *_listings tables WITHOUT an
-- is_published column (TDL #655 Phase 1 audit). Self-serve visibility gating is
-- driven entirely by is_published, so the column must exist BEFORE self-serve can
-- ship. This migration adds ONLY that column. This is a single DB operation for a
-- table shared by both mortgage repos.
--
-- SCOPE — COLUMN ADD ONLY (deliberate):
--   The full self-serve schema (submitted_via / submission_status / gbp_* /
--   submitted_ip / claim_token_expires_at + dedup indexes) is NOT added here. It
--   lands later, as part of mortgage's actual self-serve STAMP — which for this
--   vertical is a BESPOKE port (src/app scaffold ≠ nav-fix app/ template; see the
--   TDL #655 mortgage sub-ticket). Keep each vertical's rollout self-contained.
--
-- ⚠️ DEFERRED WORK — DO NOT DO IT NOW (read before shipping self-serve here):
--   mortgage_listings is an ARM of the empire_listings_union view (and the
--   empire_listings_search MV downstream). After Option B (TDL #653/#654), that
--   view PROJECTS is_published — but the mortgage arm currently hardcodes a literal
--   `true AS is_published` with NO source filter, precisely because this base table
--   had no column. Adding the column here does NOT change the view: the arm still
--   emits literal `true` (it does not reference mortgage_listings.is_published), so
--   this ADD COLUMN is safe and the view is unaffected. The view + MV regeneration
--   to actually SOURCE-FILTER the mortgage arm (project the real column + `WHERE
--   is_published IS NOT FALSE` + zero-downtime atomic swap + the MANDATORY post-swap
--   `NOTIFY pgrst, 'reload schema'`) is PER-VERTICAL work that happens AT
--   self-serve-ship time for mortgage — NOT in this Phase 0.
--   Sequencing (TDL #653 blocker-h): (a) this column add, (b) regen union view+MV,
--   (c) THEN green-light self-serve on mortgage.
--
-- SAFETY: fully additive, metadata-only.
--   * NOT NULL DEFAULT TRUE on PG 17.6 (verified empire-wide) is a metadata-only
--     add — all 31,658 existing rows read TRUE with NO table rewrite, NO backfill.
--   * No index added (matches empire norm + the pilot).
--   * mortgage_listings has NO generated-stored columns; it carries both `province`
--     (default) and `state_province` (TDL #482/#2476) — both untouched here.
--   * Existing claim flow, owner-edit "Boost" (TDL #620/#621), seeder, and the
--     union view/MV are untouched.
-- ============================================================================

BEGIN;

ALTER TABLE public.mortgage_listings
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.mortgage_listings.is_published IS
  'Directory visibility gate. Self-serve "Add My Business" stubs insert FALSE; '
  'flipped TRUE on magic-link verify. Seeded rows default TRUE. (TDL #655 Phase 0)';

COMMIT;

-- ============================================================================
-- POST-APPLY VERIFICATION (run after apply, expect listed results):
--   -- 1. Column present, correct type/nullability/default:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name='mortgage_listings' AND column_name='is_published';
--   -- expect: is_published | boolean | NO | true
--
--   -- 2. No NULLs, all existing rows TRUE (metadata default applied):
--   SELECT is_published, count(*) FROM mortgage_listings GROUP BY 1;
--   -- expect: t | 31658   (single row, zero false, zero null)
--
--   -- 3. Union view unaffected (mortgage arm still literal true, no error):
--   SELECT count(*) FROM empire_listings_union WHERE source_table='mortgage_listings';
--   -- expect: current mortgage published count — query succeeds, no column error
-- ============================================================================
