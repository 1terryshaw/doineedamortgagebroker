-- FindYourMortgageBroker.ca — Database Schema
-- Supabase instance: msqiynbhoeruqctaesqk (shared with FindYourAccountant.ca)
-- All tables prefixed with mortgage_ to avoid collisions
-- Run this in Supabase SQL Editor

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- MORTGAGE_REGIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS mortgage_regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  province TEXT NOT NULL DEFAULT 'Ontario',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  population INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mortgage_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON mortgage_regions FOR SELECT USING (true);

-- ============================================================
-- MORTGAGE_SPECIALIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS mortgage_specializations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mortgage_specializations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON mortgage_specializations FOR SELECT USING (true);

-- ============================================================
-- MORTGAGE_LISTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS mortgage_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Contact
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Address
  address TEXT,
  city TEXT,
  province TEXT DEFAULT 'Ontario',
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- Google Places data
  google_place_id TEXT UNIQUE,
  google_rating NUMERIC(2,1),
  google_review_count INTEGER DEFAULT 0,
  google_photos JSONB DEFAULT '[]'::jsonb,

  -- Profile
  logo_url TEXT,
  cover_image_url TEXT,
  years_in_business INTEGER,
  license_number TEXT,
  languages TEXT[] DEFAULT '{}',

  -- Enrichment
  enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'enriched', 'failed', 'skipped')),
  enrichment_data JSONB,

  -- Claim / ownership
  claimed BOOLEAN DEFAULT FALSE,
  claimed_by UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMPTZ,

  -- Premium
  is_premium BOOLEAN DEFAULT FALSE,
  premium_tier TEXT CHECK (premium_tier IN ('basic', 'pro', 'enterprise')),
  premium_expires_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'rejected')),

  -- Region
  region_id UUID REFERENCES mortgage_regions(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mortgage_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active listings" ON mortgage_listings FOR SELECT USING (status = 'active');
CREATE POLICY "Owners can update own listings" ON mortgage_listings FOR UPDATE USING (auth.uid() = claimed_by);
CREATE POLICY "Authenticated users can insert" ON mortgage_listings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_mortgage_listings_slug ON mortgage_listings(slug);
CREATE INDEX idx_mortgage_listings_city ON mortgage_listings(city);
CREATE INDEX idx_mortgage_listings_region ON mortgage_listings(region_id);
CREATE INDEX idx_mortgage_listings_status ON mortgage_listings(status);
CREATE INDEX idx_mortgage_listings_google_rating ON mortgage_listings(google_rating DESC NULLS LAST);
CREATE INDEX idx_mortgage_listings_claimed_by ON mortgage_listings(claimed_by);
CREATE INDEX idx_mortgage_listings_google_place_id ON mortgage_listings(google_place_id);

-- ============================================================
-- MORTGAGE_LISTING_SPECIALIZATIONS (junction table)
-- ============================================================
CREATE TABLE IF NOT EXISTS mortgage_listing_specializations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES mortgage_listings(id) ON DELETE CASCADE,
  specialization_id UUID NOT NULL REFERENCES mortgage_specializations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, specialization_id)
);

ALTER TABLE mortgage_listing_specializations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON mortgage_listing_specializations FOR SELECT USING (true);
CREATE POLICY "Owners can manage" ON mortgage_listing_specializations FOR ALL USING (
  EXISTS (SELECT 1 FROM mortgage_listings WHERE id = listing_id AND claimed_by = auth.uid())
);

CREATE INDEX idx_mls_listing ON mortgage_listing_specializations(listing_id);
CREATE INDEX idx_mls_specialization ON mortgage_listing_specializations(specialization_id);

-- ============================================================
-- MORTGAGE_INQUIRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS mortgage_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES mortgage_listings(id) ON DELETE CASCADE,

  -- Inquirer info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,

  -- Mortgage-specific fields
  mortgage_type TEXT, -- residential, commercial, refinance, etc.
  property_value NUMERIC,
  down_payment NUMERIC,
  employment_type TEXT, -- employed, self-employed, retired
  first_time_buyer BOOLEAN DEFAULT FALSE,

  -- Tracking
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'closed')),
  notification_sent BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mortgage_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create inquiry" ON mortgage_inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Listing owners can view inquiries" ON mortgage_inquiries FOR SELECT USING (
  EXISTS (SELECT 1 FROM mortgage_listings WHERE id = listing_id AND claimed_by = auth.uid())
);
CREATE POLICY "Listing owners can update inquiries" ON mortgage_inquiries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM mortgage_listings WHERE id = listing_id AND claimed_by = auth.uid())
);

CREATE INDEX idx_mortgage_inquiries_listing ON mortgage_inquiries(listing_id);
CREATE INDEX idx_mortgage_inquiries_status ON mortgage_inquiries(status);

-- ============================================================
-- MORTGAGE_EMAIL_TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS mortgage_email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  variables TEXT[] DEFAULT '{}', -- list of template variable names
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mortgage_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active templates" ON mortgage_email_templates FOR SELECT USING (active = true);

-- ============================================================
-- MORTGAGE_EMAIL_LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS mortgage_email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mortgage_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access" ON mortgage_email_log FOR SELECT USING (false);

CREATE INDEX idx_mortgage_email_log_recipient ON mortgage_email_log(recipient_email);
CREATE INDEX idx_mortgage_email_log_created ON mortgage_email_log(created_at DESC);

-- ============================================================
-- SEED: Specializations
-- ============================================================
INSERT INTO mortgage_specializations (name, slug, description, icon) VALUES
  ('Residential Mortgages', 'residential', 'Home purchases and residential property financing', 'home'),
  ('Commercial Mortgages', 'commercial', 'Commercial and multi-unit property financing', 'building'),
  ('Refinancing', 'refinance', 'Mortgage refinancing and debt consolidation', 'refresh-cw'),
  ('First-Time Buyer', 'first-time-buyer', 'Specialized support for first-time home buyers', 'key'),
  ('Self-Employed', 'self-employed', 'Mortgage solutions for self-employed borrowers', 'briefcase'),
  ('Investment Property', 'investment-property', 'Financing for rental and investment properties', 'trending-up'),
  ('Private Lending', 'private-lending', 'Alternative and private mortgage solutions', 'shield'),
  ('Reverse Mortgage', 'reverse-mortgage', 'Reverse mortgage products for seniors', 'rotate-ccw'),
  ('Construction', 'construction', 'Construction and renovation financing', 'hammer')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: Ontario Regions (60 cities)
-- ============================================================
INSERT INTO mortgage_regions (name, slug, province) VALUES
  ('Toronto', 'toronto', 'Ontario'),
  ('Ottawa', 'ottawa', 'Ontario'),
  ('Mississauga', 'mississauga', 'Ontario'),
  ('Brampton', 'brampton', 'Ontario'),
  ('Hamilton', 'hamilton', 'Ontario'),
  ('London', 'london', 'Ontario'),
  ('Markham', 'markham', 'Ontario'),
  ('Vaughan', 'vaughan', 'Ontario'),
  ('Kitchener', 'kitchener', 'Ontario'),
  ('Windsor', 'windsor', 'Ontario'),
  ('Richmond Hill', 'richmond-hill', 'Ontario'),
  ('Oakville', 'oakville', 'Ontario'),
  ('Burlington', 'burlington', 'Ontario'),
  ('Oshawa', 'oshawa', 'Ontario'),
  ('Barrie', 'barrie', 'Ontario'),
  ('St. Catharines', 'st-catharines', 'Ontario'),
  ('Cambridge', 'cambridge', 'Ontario'),
  ('Kingston', 'kingston', 'Ontario'),
  ('Guelph', 'guelph', 'Ontario'),
  ('Whitby', 'whitby', 'Ontario'),
  ('Ajax', 'ajax', 'Ontario'),
  ('Thunder Bay', 'thunder-bay', 'Ontario'),
  ('Chatham-Kent', 'chatham-kent', 'Ontario'),
  ('Waterloo', 'waterloo', 'Ontario'),
  ('Sudbury', 'sudbury', 'Ontario'),
  ('Brantford', 'brantford', 'Ontario'),
  ('Pickering', 'pickering', 'Ontario'),
  ('Niagara Falls', 'niagara-falls', 'Ontario'),
  ('Newmarket', 'newmarket', 'Ontario'),
  ('Peterborough', 'peterborough', 'Ontario'),
  ('Sault Ste. Marie', 'sault-ste-marie', 'Ontario'),
  ('Sarnia', 'sarnia', 'Ontario'),
  ('Caledon', 'caledon', 'Ontario'),
  ('North Bay', 'north-bay', 'Ontario'),
  ('Belleville', 'belleville', 'Ontario'),
  ('Cornwall', 'cornwall', 'Ontario'),
  ('Halton Hills', 'halton-hills', 'Ontario'),
  ('Georgetown', 'georgetown', 'Ontario'),
  ('Aurora', 'aurora', 'Ontario'),
  ('Welland', 'welland', 'Ontario'),
  ('Stouffville', 'stouffville', 'Ontario'),
  ('Orangeville', 'orangeville', 'Ontario'),
  ('Orillia', 'orillia', 'Ontario'),
  ('Stratford', 'stratford', 'Ontario'),
  ('Bradford', 'bradford', 'Ontario'),
  ('Woodstock', 'woodstock', 'Ontario'),
  ('Clarington', 'clarington', 'Ontario'),
  ('Milton', 'milton', 'Ontario'),
  ('New Tecumseth', 'new-tecumseth', 'Ontario'),
  ('Innisfil', 'innisfil', 'Ontario'),
  ('Collingwood', 'collingwood', 'Ontario'),
  ('Wasaga Beach', 'wasaga-beach', 'Ontario'),
  ('Cobourg', 'cobourg', 'Ontario'),
  ('Port Hope', 'port-hope', 'Ontario'),
  ('Timmins', 'timmins', 'Ontario'),
  ('Kenora', 'kenora', 'Ontario'),
  ('Brockville', 'brockville', 'Ontario'),
  ('Leamington', 'leamington', 'Ontario'),
  ('Grimsby', 'grimsby', 'Ontario'),
  ('Smiths Falls', 'smiths-falls', 'Ontario')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: Email Templates
-- ============================================================
INSERT INTO mortgage_email_templates (name, subject, html_body, text_body, variables) VALUES
(
  'inquiry_notification',
  'New Inquiry from {{inquirer_name}} — FindYourMortgageBroker.ca',
  '<h2>You have a new inquiry!</h2>
<p><strong>From:</strong> {{inquirer_name}} ({{inquirer_email}})</p>
<p><strong>Phone:</strong> {{inquirer_phone}}</p>
<p><strong>Mortgage Type:</strong> {{mortgage_type}}</p>
<p><strong>First-Time Buyer:</strong> {{first_time_buyer}}</p>
<p><strong>Message:</strong></p>
<p>{{message}}</p>
<hr>
<p>Log in to your <a href="https://findyourmortgagebroker.ca/dashboard">dashboard</a> to respond.</p>',
  'New inquiry from {{inquirer_name}} ({{inquirer_email}})
Phone: {{inquirer_phone}}
Mortgage Type: {{mortgage_type}}
First-Time Buyer: {{first_time_buyer}}
Message: {{message}}

Log in to your dashboard to respond: https://findyourmortgagebroker.ca/dashboard',
  ARRAY['inquirer_name', 'inquirer_email', 'inquirer_phone', 'mortgage_type', 'first_time_buyer', 'message']
),
(
  'inquiry_confirmation',
  'Your inquiry has been sent — FindYourMortgageBroker.ca',
  '<h2>Thank you for your inquiry!</h2>
<p>Hi {{inquirer_name}},</p>
<p>Your message has been sent to <strong>{{broker_name}}</strong>. They typically respond within 1-2 business days.</p>
<p>In the meantime, you can browse more mortgage brokers at <a href="https://findyourmortgagebroker.ca">FindYourMortgageBroker.ca</a>.</p>',
  'Thank you for your inquiry, {{inquirer_name}}!
Your message has been sent to {{broker_name}}. They typically respond within 1-2 business days.
Browse more brokers: https://findyourmortgagebroker.ca',
  ARRAY['inquirer_name', 'broker_name']
),
(
  'follow_up',
  'Following up on your inquiry — FindYourMortgageBroker.ca',
  '<h2>Following up</h2>
<p>Hi {{broker_name}},</p>
<p>You received an inquiry from <strong>{{inquirer_name}}</strong> {{days_ago}} days ago that hasn''t been responded to yet.</p>
<p>Quick responses lead to more clients. <a href="https://findyourmortgagebroker.ca/dashboard">Log in to respond now</a>.</p>',
  'Hi {{broker_name}},
You received an inquiry from {{inquirer_name}} {{days_ago}} days ago.
Log in to respond: https://findyourmortgagebroker.ca/dashboard',
  ARRAY['broker_name', 'inquirer_name', 'days_ago']
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- FUNCTION: Update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION mortgage_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mortgage_listings_updated_at
  BEFORE UPDATE ON mortgage_listings
  FOR EACH ROW EXECUTE FUNCTION mortgage_update_updated_at();

CREATE TRIGGER mortgage_regions_updated_at
  BEFORE UPDATE ON mortgage_regions
  FOR EACH ROW EXECUTE FUNCTION mortgage_update_updated_at();

CREATE TRIGGER mortgage_inquiries_updated_at
  BEFORE UPDATE ON mortgage_inquiries
  FOR EACH ROW EXECUTE FUNCTION mortgage_update_updated_at();

CREATE TRIGGER mortgage_email_templates_updated_at
  BEFORE UPDATE ON mortgage_email_templates
  FOR EACH ROW EXECUTE FUNCTION mortgage_update_updated_at();
