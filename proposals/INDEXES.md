# Terry-GO proposals — mortgage_listings statement timeouts (57014)

**Status:** PROPOSAL ONLY. No DDL, migrations, pooler, or compute changes in this PR.
**Context:** Stream 65 site-health. Live evidence 2026-11-13 ~10:43 AM ET:
homepage TTFB ~9.7s, `/directory?region=AZ` TTFB ~8.3s (earlier timed out at 25s).
Production READY rollback target: `dpl_GD2U48wzm8G5Gz2u4LeULaWESdzy`.

Code-only mitigations (id keyset facet/sitemap walks, homepage + directory soft-shell,
sitemap `generateStaticParams → []` + ISR, deserve-gate 2s AbortSignal) ship in this
branch. The items below need an explicit Terry GO before apply.

## 1. Covering index for directory sort

`getFilteredListingsPaged` orders by
`(google_rating DESC NULLS LAST, google_review_count DESC NULLS LAST, name, id)`
and filters `country = $COUNTRY AND is_active AND is_published IS DISTINCT FROM false`,
optionally `province = $STATE`.

```sql
-- PROPOSAL ONLY — do not apply without Terry GO
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mortgage_listings_dir_sort_v1
  ON mortgage_listings (
    country,
    province,
    google_rating DESC NULLS LAST,
    google_review_count DESC NULLS LAST,
    name ASC,
    id ASC
  )
  WHERE is_active = true AND is_published IS DISTINCT FROM false;
```

## 2. Partial index for sitemap / facet keyset walk

Sitemap children and `getDirectoryRegions` walk `ORDER BY id` with
`country = $COUNTRY AND is_active AND is_published IS DISTINCT FROM false`.
PK alone still rechecks the filter on every keyset page:

```sql
-- PROPOSAL ONLY — do not apply without Terry GO
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mortgage_listings_sitemap_id
  ON mortgage_listings (id)
  WHERE is_active = true
    AND is_published IS DISTINCT FROM false
    AND country IN ('CA', 'US');
```

## 3. Pooler / statement_timeout posture

PostgREST/`authenticator` statement_timeout is ~8s. Homepage previously scanned
tens of thousands of listing rows via deep OFFSET for region facets. Options for
Terry GO (ops, not this repo):

- Raise `statement_timeout` modestly for the sitemap/service role only (not
  globally), **or**
- Pin sitemap emitters to a less-contended pooler port / session mode during
  deploy windows, **or**
- Keep code mitigations (this PR) and accept on-demand ISR for sitemap children.

## 4. Compute / RAM headroom

Fleet builds already serialize via empire-build-lock (TDL #1244 / K306). If 57014
continues after indexes + code mitigations during matview refresh hours
(`:20–:23` UTC on 02/08/14/20), treat as compute/RAM pressure on main Postgres —
escalate per K306 rather than widening app timeouts.

## 5. Fleet-wide deserve_gate AbortSignal sync (proposal only)

This repo's `lib/deserve-gate.ts` is the **only adapted copy** in the fleet
(route `/listing/<slug>`, no `vertical.config.ts`) — not byte-identical to
`empire-policy/deserve_gate.ts`. The ~2s `AbortSignal.timeout(2000)` should be
synced into the canonical donor before any fleet fan-out. **Do not fan out from
this PR.**
