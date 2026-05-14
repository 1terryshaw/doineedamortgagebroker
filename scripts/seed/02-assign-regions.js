/**
 * 02-assign-regions.js
 *
 * Reads all mortgage_listings and mortgage_regions from Supabase,
 * matches each listing's city to a region, and sets the region_id.
 *
 * Usage:  node scripts/seed/02-assign-regions.js
 * Env:    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Config & validation
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// City name normalization for fuzzy matching
// ---------------------------------------------------------------------------

/**
 * Normalize a city name for comparison:
 * - lowercase
 * - remove periods (St. vs St)
 * - remove extra whitespace
 * - trim
 */
function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a lookup map from normalized region name -> region object.
 * Also adds common variations/aliases.
 */
function buildRegionLookup(regions) {
  const lookup = new Map();

  for (const region of regions) {
    lookup.set(normalize(region.name), region);
  }

  // Common variations
  const aliases = {
    'st catharines': 'st catharines',
    'saint catharines': 'st catharines',
    'sault ste marie': 'sault ste marie',
    'sault saint marie': 'sault ste marie',
    'sault sainte marie': 'sault ste marie',
    'greater sudbury': 'sudbury',
    'chatham': 'chatham-kent',
    'kent': 'chatham-kent',
    'whitchurch-stouffville': 'stouffville',
    'whitchurch stouffville': 'stouffville',
    'bradford west gwillimbury': 'bradford',
    'halton hills / georgetown': 'halton hills',
    'new tecumseth / alliston': 'new tecumseth',
    'alliston': 'new tecumseth',
    'bowmanville': 'clarington',
    'newcastle': 'clarington',
    'courtice': 'clarington',
  };

  for (const [alias, target] of Object.entries(aliases)) {
    const region = lookup.get(normalize(target));
    if (region) {
      lookup.set(normalize(alias), region);
    }
  }

  return lookup;
}

/**
 * Attempt to match a listing's city to a region.
 * Tries exact match first, then checks if region name is contained in city or vice versa.
 */
function findRegion(city, regionLookup) {
  if (!city) return null;

  const normalizedCity = normalize(city);

  // Exact match
  if (regionLookup.has(normalizedCity)) {
    return regionLookup.get(normalizedCity);
  }

  // Check if any region name is contained in the city name, or vice versa
  for (const [regionName, region] of regionLookup) {
    if (normalizedCity.includes(regionName) || regionName.includes(normalizedCity)) {
      return region;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Assign Regions Script ===\n');

  // Fetch all regions
  const { data: regions, error: regErr } = await supabase
    .from('mortgage_regions')
    .select('*');

  if (regErr) {
    console.error('Error fetching regions:', regErr.message);
    process.exit(1);
  }

  console.log(`Loaded ${regions.length} regions`);
  const regionLookup = buildRegionLookup(regions);

  // Fetch all listings (paginate in batches of 1000)
  let allListings = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data: batch, error: listErr } = await supabase
      .from('mortgage_listings')
      .select('id, city, region_id')
      .range(from, from + pageSize - 1);

    if (listErr) {
      console.error('Error fetching listings:', listErr.message);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;
    allListings = allListings.concat(batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Loaded ${allListings.length} listings\n`);

  let assigned = 0;
  let alreadyAssigned = 0;
  let unmatched = 0;
  const unmatchedCities = new Set();

  for (const listing of allListings) {
    // Skip if already assigned
    if (listing.region_id) {
      alreadyAssigned++;
      continue;
    }

    const region = findRegion(listing.city, regionLookup);

    if (!region) {
      unmatched++;
      if (listing.city) {
        unmatchedCities.add(listing.city);
      }
      continue;
    }

    const { error: updateErr } = await supabase
      .from('mortgage_listings')
      .update({ region_id: region.id })
      .eq('id', listing.id);

    if (updateErr) {
      console.error(`Error updating listing ${listing.id}:`, updateErr.message);
      continue;
    }

    assigned++;
  }

  console.log('=== Summary ===');
  console.log(`Total listings:    ${allListings.length}`);
  console.log(`Newly assigned:    ${assigned}`);
  console.log(`Already assigned:  ${alreadyAssigned}`);
  console.log(`Unmatched:         ${unmatched}`);

  if (unmatchedCities.size > 0) {
    console.log(`\nUnmatched cities (${unmatchedCities.size}):`);
    for (const city of unmatchedCities) {
      console.log(`  - ${city}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
