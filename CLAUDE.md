# DoINeedAMortgageBroker

## Project Identity
- **Domain**: doineedamortgagebroker.com
- **What**: SEO-driven directory of US mortgage brokers, loan originators, and broker firms sourced from state regulator records
- **Audience**: US borrowers searching for licensed mortgage brokers by city / specialization
- **Forked from**: findyourmortgagebroker (CA-Ontario sibling) on 2026-05-14

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database**: Supabase (shared empire instance)
- **Auth**: Supabase Auth
- **Email**: Gmail SMTP via Nodemailer
- **Hosting**: Vercel

## Database Conventions
- Shares `mortgage_listings`, `mortgage_regions`, `mortgage_specializations`, `mortgage_listing_specializations`, `mortgage_inquiries`, `mortgage_email_*` with empire canonical
- **All queries filter on `country = 'US'`** to isolate from the CA sibling
- Region province codes are 2-letter US state codes (FL, TX, NY, etc.)

## Empire Build Standards (NON-NEGOTIABLE)
- favicon (favicon.ico + favicon.png)
- schema.org JSON-LD on every listing + city page
- OpenGraph + Twitter Card meta on all pages
- Real meta descriptions (no defaults)
- Disclaimer banner site-wide ("not financial advice")
- "Other" as last dropdown option for any open-vocab field
- NO "Most Popular" badge
- Email unsubscribe link + `List-Unsubscribe` header on all outbound

## Phase 2 Data Source
- **FL OFR**: monthly public ZIPs on `real.flofr.com` — `LoanOriginators_*_Monthly.zip` (A-I/J-R/S-Z), `MortgageFirms_MBR-MBRB_Monthly.zip`, `MortgageFirms_MLD-MLDB_Monthly.zip`
- Filter: STATUS = 'Approved' (active licensees)
- Yield: ~78K active rows from FL alone

## Repo Structure
```
src/
├── app/                  # Next.js App Router pages
├── components/           # React components (incl. Disclaimer.tsx site-wide)
├── lib/                  # Supabase client, email, utils, constants
└── types/                # TypeScript types
```

## Environment Variables
Copy `.env.local.example` to `.env.local` and populate from `~/empire/secrets/master.env`.

## Home page is `force-dynamic` — DOCUMENTED EXCEPTION, do not "fix" it

**Date locked:** 2026-09-22 · **TDL #1262 / #1244** · `homepage-isr-fan-v1` → `homeisr-purge-stamp-v1`

This repo is the **one repo of 67** excluded from the empire-wide home-page ISR fan. `/` stays
`force-dynamic`. That is a ruling, not an oversight, and it is not a candidate for a drive-by fix.

**Why.** `src/app/layout.tsx` calls `(await headers()).get("x-uk-pathname")` to decide whether to
render the **US chrome** — the amber `<Disclaimer/>` ("not financial advice / state regulator
records"), the US `<Header/>`, and the US `<Footer/>` whose verify line names **NMLS Consumer
Access**. The `/uk` subtree must render **none** of it: that is the **FCA neutralization**
mechanism, and a nested layout cannot strip a parent layout's siblings, so the detection has to
live in the **root** layout.

`headers()` is a dynamic API. Reading it in the **root** layout makes **every route beneath it**
dynamic — including `/`. No amount of read conversion can undo that: this is mechanism 6 of the
eight documented in **K291**, and it is the only one of the eight that a cacheable-read fix cannot
reach. `export const revalidate` here would be **inert**, and would ship looking perfect in the
diff. During the fan the inert directive edit was **reverted rather than shipped**, deliberately.

**Consequences, accepted:**
- `/` re-renders per request, so a blip on the shared Supabase instance is a user-visible error on
  the most valuable page of the site. That is the cost of the FCA split.
- There is **no purge path** stamped here and none is owed: nothing about `/` is cached, so there
  is nothing to evict. This repo is the one target `homeisr-purge-stamp-v1` deliberately skipped.

**What it would take to revisit** (nobody has asked for this; do not start it unprompted):
the root layout would have to stop reading `headers()` and the UK/US split would have to become
**two cached variants** rather than one per-request branch — e.g. the middleware **rewriting**
`/uk/*` into a distinct route group with its own root layout, so each variant is a separately
prerenderable segment and neither needs a request header to know which chrome it is. That is a
routing change to an **FCA-compliance** mechanism. It needs Terry's explicit ruling before a line
is written, and the gate is that the `/uk` subtree renders **zero** US chrome — no `<Disclaimer/>`,
no NMLS verify line — proven on the deployed host, not in a diff.
