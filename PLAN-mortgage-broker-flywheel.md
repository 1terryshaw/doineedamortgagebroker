# Mortgage Broker Marketing Flywheel — Build Plan

## What This Is
Clone the FindYourAccountant.ca playbook for mortgage brokers in Ontario. Same architecture, same monetization, different vertical. Innes Robinson also has a mortgage brokerage — he's the pilot client again.

## Pilot Client
- **Innes Robinson** — also operates a mortgage brokerage
- Problem: needs more borrowers
- Perfect test: same person, different business, proves the model clones

## Market Size
- FSRA (Financial Services Regulatory Authority) regulates mortgage brokers in Ontario
- ~12,000+ licensed mortgage agents/brokers in Ontario
- Public registry available (same ToS constraints as CPA Ontario — seed from Google Places)
- High-intent search market: "mortgage broker Toronto", "best mortgage rates Ontario"

## The Flywheel (same pattern as accountants)

### FindYourMortgageBroker.ca (directory)
- Seed from Google Places: "mortgage broker in {city} Ontario"
- Same schema: listings, specializations, regions, reviews
- Specializations: residential, commercial, refinance, first-time buyer, self-employed, investment property, private lending, reverse mortgage, construction
- City landing pages, listing detail pages, search with filters
- Claim flow, dashboard editor, premium tier

### DoINeedAMortgageBroker.com (triage funnel)
- Triage quiz: "What's your situation?"
  - Buying first home → first-time buyer specialist
  - Refinancing → refinance specialist
  - Self-employed → self-employed mortgage specialist
  - Investment property → investment specialist
  - Bad credit → alternative/private lending specialist
  - Commercial property → commercial mortgage specialist
- Each path = SEO page + filtered directory search
- Example pages: /first-time-home-buyer-mortgage-ontario, /self-employed-mortgage-broker-toronto

### Website Template
- Clone Maple & Co template → "Oakville Mortgage Co" or similar
- Sections: rates calculator, pre-approval form, services, team, reviews
- PIA onboarding: one command deploys broker site from listing data

## Tech Stack (identical to accountant flywheel)
- Next.js 14+ / Vercel / Supabase (same instance) / Gmail SMTP
- Separate Vercel project, separate domain, shared DB tables with profession filter
- OR: extend pro-directory to support multiple professions (cleaner long-term)

## Architecture Decision: Separate App vs Extend Pro-Directory?

### Option A: Separate App (faster to launch)
- New repo: findyourmortgagebroker
- Cloned from findmyaccountant codebase
- Separate Vercel project, separate domain
- Pro: No risk of breaking accountant site
- Con: Two codebases to maintain

### Option B: Multi-Profession Pro-Directory (better long-term)
- Extend existing pro-directory to support multiple professions
- URL structure: findyourpro.ca/accountants/toronto, findyourpro.ca/mortgage-brokers/toronto
- OR: keep separate domains but single codebase with config-driven branding
- Pro: One codebase, shared improvements benefit all verticals
- Con: More complex, domain/branding gets tricky

### Recommendation: Option A now, migrate to B later
- Clone the accountant app for mortgage brokers
- Get it live fast
- Once you have 3+ verticals, refactor into multi-profession platform

## Data Pipeline
- Same Google Places seeding: "mortgage broker in {city} Ontario"
- Same Claude enrichment: scrape broker websites for specializations
- ~60 Ontario cities × 3 queries = ~180 API calls
- Expected: 1,000-2,000 unique broker listings

## Monetization (same tiers)
- Free: Google-seeded listing
- Claimed (free): edit profile, get inquiry notifications
- Premium ($29-49/mo): priority placement, lead form, analytics
- Website ($197-397/mo): MTB website package
- Agent Team ($497-997/mo): future upsell

## SEO Content Pages
- /guides/fixed-vs-variable-rate-mortgage-canada
- /guides/how-much-mortgage-can-i-afford-ontario
- /guides/first-time-home-buyer-programs-ontario
- /guides/mortgage-broker-vs-bank-canada
- /guides/refinancing-your-mortgage-when-and-why
- /guides/self-employed-mortgage-guide-canada

## Real Estate Expansion
- Same FSRA regulates real estate (RECO has 90,000+ agents)
- FindYourRealtor.ca — same playbook, third vertical
- Cross-linking opportunity: mortgage broker recommends realtor, realtor recommends mortgage broker
- "FindYourPro" network effect

## Build Sequence
1. Register findyourmortgagebroker.ca (check availability)
2. Clone pro-directory codebase
3. Swap branding, profession types, specialization taxonomy
4. Seed from Google Places
5. Enrich with Claude
6. Deploy to Vercel
7. Onboard Innes as pilot
8. Create mortgage-specific guide pages
9. Build DoINeedAMortgageBroker.com triage

## Connection to Flywheel
- Proves the model clones across verticals
- Shared Supabase instance, shared PIA tooling
- Each new vertical is faster to launch than the last
- Cross-referral network between professions

## Discovery Questions for Innes (Mortgage Side)
- What's your brokerage name and license #?
- Who's your target borrower? (first-time, refinance, self-employed?)
- What geographic area do you serve?
- What's your current lead generation? (referrals, online, ads?)
- How many deals per month are you doing vs want to do?
- Do you have a team or solo?
- What differentiates you from other brokers?
