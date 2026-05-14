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
