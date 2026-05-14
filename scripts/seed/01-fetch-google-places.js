/**
 * 01-fetch-google-places.js
 *
 * Searches Google Places API for mortgage brokers across 60 Ontario cities
 * and inserts results into Supabase mortgage_listings table.
 *
 * Usage:  node scripts/seed/01-fetch-google-places.js
 * Env:    GOOGLE_PLACES_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Config & validation
// ---------------------------------------------------------------------------
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GOOGLE_API_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Ontario cities (60)
// ---------------------------------------------------------------------------
const CITIES = [
  'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton',
  'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor',
  'Richmond Hill', 'Oakville', 'Burlington', 'Oshawa', 'Barrie',
  'St. Catharines', 'Cambridge', 'Kingston', 'Guelph', 'Whitby',
  'Ajax', 'Thunder Bay', 'Chatham-Kent', 'Waterloo', 'Sudbury',
  'Brantford', 'Pickering', 'Niagara Falls', 'Newmarket', 'Peterborough',
  'Sault Ste. Marie', 'Sarnia', 'Caledon', 'North Bay', 'Belleville',
  'Cornwall', 'Halton Hills', 'Georgetown', 'Aurora', 'Welland',
  'Stouffville', 'Orangeville', 'Orillia', 'Stratford', 'Bradford',
  'Woodstock', 'Clarington', 'Milton', 'New Tecumseth', 'Innisfil',
  'Collingwood', 'Wasaga Beach', 'Cobourg', 'Port Hope', 'Timmins',
  'Kenora', 'Brockville', 'Leamington', 'Grimsby', 'Smiths Falls',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a URL-friendly slug from a business name.
 * Lowercase, replace non-alphanum with hyphens, collapse multiples, trim.
 */
function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ensure slug uniqueness by appending a counter if needed.
 */
function dedupeSlug(slug, existingSlugs) {
  if (!existingSlugs.has(slug)) {
    existingSlugs.add(slug);
    return slug;
  }
  let counter = 2;
  while (existingSlugs.has(`${slug}-${counter}`)) {
    counter++;
  }
  const unique = `${slug}-${counter}`;
  existingSlugs.add(unique);
  return unique;
}

/**
 * Extract city name from a formatted address string.
 */
function extractCity(address, searchCity) {
  // Best effort: return the city we searched for
  return searchCity;
}

/**
 * Call Google Places Text Search (New) API.
 * Uses the v1 Places API (new) endpoint.
 */
async function searchPlaces(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const body = {
    textQuery: query,
    languageCode: 'en',
    maxResultCount: 20,
  };

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.photos',
    'places.location',
  ].join(',');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Places API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.places || [];
}

/**
 * Convert a Google Places (new) result to a mortgage_listings row.
 */
function placeToListing(place, city, existingSlugs) {
  const name = place.displayName?.text || place.displayName || '';
  const slug = dedupeSlug(makeSlug(name), existingSlugs);

  // Extract photo references
  const photos = (place.photos || []).slice(0, 5).map((p) => ({
    name: p.name,
    widthPx: p.widthPx,
    heightPx: p.heightPx,
  }));

  return {
    name: name,
    slug,
    address: place.formattedAddress || null,
    city,
    province: 'Ontario',
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    website: place.websiteUri || null,
    google_place_id: place.id || null,
    google_rating: place.rating || null,
    google_review_count: place.userRatingCount || 0,
    google_photos: photos,
    latitude: place.location?.latitude || null,
    longitude: place.location?.longitude || null,
    status: 'active',
    enrichment_status: 'pending',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Google Places Seed Script ===');
  console.log(`Processing ${CITIES.length} Ontario cities\n`);

  // Load existing slugs to avoid collisions
  const { data: existingListings, error: slugErr } = await supabase
    .from('mortgage_listings')
    .select('slug');

  if (slugErr) {
    console.error('Error loading existing slugs:', slugErr.message);
    process.exit(1);
  }

  const existingSlugs = new Set((existingListings || []).map((l) => l.slug));

  // Load existing google_place_ids to skip duplicates
  const { data: existingPlaces, error: placeErr } = await supabase
    .from('mortgage_listings')
    .select('google_place_id')
    .not('google_place_id', 'is', null);

  if (placeErr) {
    console.error('Error loading existing place IDs:', placeErr.message);
    process.exit(1);
  }

  const existingPlaceIds = new Set((existingPlaces || []).map((p) => p.google_place_id));

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i];
    const query = `mortgage broker in ${city} Ontario`;

    console.log(`[${i + 1}/${CITIES.length}] Searching: "${query}"`);

    try {
      const places = await searchPlaces(query);
      console.log(`  Found ${places.length} results`);

      let cityInserted = 0;
      let citySkipped = 0;

      for (const place of places) {
        const placeId = place.id;

        // Skip duplicates
        if (placeId && existingPlaceIds.has(placeId)) {
          citySkipped++;
          totalSkipped++;
          continue;
        }

        const listing = placeToListing(place, city, existingSlugs);

        const { error: insertErr } = await supabase
          .from('mortgage_listings')
          .insert(listing);

        if (insertErr) {
          // Handle unique constraint violations gracefully
          if (insertErr.code === '23505') {
            citySkipped++;
            totalSkipped++;
          } else {
            console.error(`  Error inserting "${listing.name}":`, insertErr.message);
            totalErrors++;
          }
          continue;
        }

        // Track this place_id so we don't re-insert across cities
        if (placeId) {
          existingPlaceIds.add(placeId);
        }

        cityInserted++;
        totalInserted++;
      }

      console.log(`  Inserted: ${cityInserted} | Skipped (dupes): ${citySkipped}`);
    } catch (err) {
      console.error(`  ERROR for ${city}:`, err.message);
      totalErrors++;
    }

    // Rate limit: 1 second between city searches
    if (i < CITIES.length - 1) {
      await sleep(1000);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total skipped:  ${totalSkipped}`);
  console.log(`Total errors:   ${totalErrors}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
