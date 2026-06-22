-- ============================================================================
-- ROLLBACK — Self-Serve Phase 0 is_published add on public.mortgage_listings
-- TDL: #655 Phase 0   Date: 2026-06-22
--
-- PRECONDITION: only safe to run while mortgage self-serve is NOT live and no row
-- depends on is_published for visibility (i.e. no is_published=false stubs exist).
-- If self-serve has shipped, DO NOT roll back — dropping the column would un-hide
-- every pending/unverified stub.
--   Guard check before running:
--     SELECT count(*) FROM mortgage_listings WHERE is_published = false;  -- must be 0
--
-- The empire_listings_union mortgage arm projects a literal `true` and does NOT
-- reference this column, so dropping it does not affect the view.
-- ============================================================================

BEGIN;

ALTER TABLE public.mortgage_listings
  DROP COLUMN IF EXISTS is_published;

COMMIT;
