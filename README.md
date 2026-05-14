# DoINeedAMortgageBroker

A US directory of licensed mortgage brokers and loan originators sourced from official state regulator records. Forked from `findyourmortgagebroker` (Ontario sibling) on 2026-05-14.

**Live:** https://doineedamortgagebroker.com

**This is not financial advice.** This site is a directory, not a licensed financial advisor.

## Stack

- Next.js 14 (App Router) on Vercel
- Supabase (shared empire instance) with `mortgage_listings` filtered to `country='US'`
- Tailwind CSS, navy/teal theme
- Gmail SMTP for outbound

## Local development

```bash
cp .env.local.example .env.local
# fill in values from ~/empire/secrets/master.env
npm install
npm run dev
```

## Data source

Florida OFR — public monthly CSV ZIPs at `https://real.flofr.com/Public/`. Loaded via the empire `mortgage-fl-2026-05-14` pipeline.

## See also

- `CLAUDE.md` for project conventions
- `~/empire/usa-phase/mortgage-tier1-recon-2026-05-14/` for the Phase-1 state regulator recon
- `~/empire/usa-phase/mortgage-fl-2026-05-14/` for the FL load transform + load artifacts
