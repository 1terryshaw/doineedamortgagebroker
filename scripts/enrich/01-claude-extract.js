/**
 * 01-claude-extract.js
 *
 * Reads mortgage_listings with enrichment_status = 'pending' that have a website URL,
 * fetches each website, sends content to Claude for extraction, and updates the listing
 * with description, languages, years_in_business, and specialization junction records.
 *
 * Usage:  node scripts/enrich/01-claude-extract.js
 * Env:    ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Config & validation
// ---------------------------------------------------------------------------
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BATCH_SIZE = 10;
const RATE_LIMIT_MS = 2000;
const FETCH_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a website's HTML content with timeout and error handling.
 */
async function fetchWebsite(url) {
  // Ensure URL has a protocol
  let fetchUrl = url;
  if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
    fetchUrl = 'https://' + fetchUrl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; FindYourMortgageBroker/1.0; +https://findyourmortgagebroker.ca)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Strip HTML tags and excessive whitespace to get plain text.
 * Also removes script/style blocks.
 */
function htmlToText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Call Claude API to extract broker information from website text.
 */
async function extractWithClaude(websiteText, businessName) {
  // Truncate to avoid token limits — keep first ~12000 chars
  const truncated = websiteText.slice(0, 12000);

  const prompt = `Extract mortgage broker specializations, languages, years in business, and a 2-3 sentence description from this website content.

Business name: ${businessName}

Website content:
${truncated}

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "description": "A 2-3 sentence description of the mortgage broker and their services.",
  "languages": ["English", "French"],
  "years_in_business": 10,
  "specializations": ["residential", "refinance", "first-time-buyer"]
}

Rules for the JSON response:
- "description": A concise 2-3 sentence summary of the broker. If not enough info, write a generic description using the business name.
- "languages": Array of languages they serve in. Default to ["English"] if not mentioned.
- "years_in_business": Integer number of years. Use null if not determinable.
- "specializations": Array of slugs from this list ONLY: residential, commercial, refinance, first-time-buyer, self-employed, investment-property, private-lending, reverse-mortgage, construction. Include only those clearly mentioned or implied on the website.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Parse JSON from response — handle potential markdown code fences
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(jsonStr);
  return parsed;
}

/**
 * Load all specializations from Supabase and return a slug -> id map.
 */
async function loadSpecializations() {
  const { data, error } = await supabase
    .from('mortgage_specializations')
    .select('id, slug');

  if (error) {
    throw new Error(`Error loading specializations: ${error.message}`);
  }

  const map = new Map();
  for (const spec of data || []) {
    map.set(spec.slug, spec.id);
  }
  return map;
}

/**
 * Insert specialization junction records for a listing.
 */
async function assignSpecializations(listingId, specSlugs, specMap) {
  const records = [];
  for (const slug of specSlugs) {
    const specId = specMap.get(slug);
    if (specId) {
      records.push({
        listing_id: listingId,
        specialization_id: specId,
      });
    }
  }

  if (records.length === 0) return 0;

  // Delete existing junction records for this listing first to avoid duplicates
  await supabase
    .from('mortgage_listing_specializations')
    .delete()
    .eq('listing_id', listingId);

  const { error } = await supabase
    .from('mortgage_listing_specializations')
    .insert(records);

  if (error) {
    throw new Error(`Error inserting specializations: ${error.message}`);
  }

  return records.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Claude Enrichment Script ===\n');

  // Load specialization lookup
  const specMap = await loadSpecializations();
  console.log(`Loaded ${specMap.size} specializations`);

  // Fetch pending listings with websites, paginating in batches
  let allPending = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('mortgage_listings')
      .select('id, name, website')
      .eq('enrichment_status', 'pending')
      .not('website', 'is', null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching pending listings:', error.message);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;
    allPending = allPending.concat(batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Found ${allPending.length} pending listings with websites\n`);

  if (allPending.length === 0) {
    console.log('Nothing to process. Done.');
    return;
  }

  let enriched = 0;
  let failed = 0;

  // Process in batches
  for (let batchStart = 0; batchStart < allPending.length; batchStart += BATCH_SIZE) {
    const batch = allPending.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allPending.length / BATCH_SIZE);

    console.log(`--- Batch ${batchNum}/${totalBatches} (${batch.length} listings) ---`);

    for (let i = 0; i < batch.length; i++) {
      const listing = batch[i];
      const globalIndex = batchStart + i + 1;

      console.log(
        `  [${globalIndex}/${allPending.length}] Processing: ${listing.name}`
      );
      console.log(`    Website: ${listing.website}`);

      try {
        // Step 1: Fetch website
        console.log('    Fetching website...');
        const html = await fetchWebsite(listing.website);
        const text = htmlToText(html);

        if (text.length < 50) {
          console.log('    Website content too short, marking as failed');
          await supabase
            .from('mortgage_listings')
            .update({
              enrichment_status: 'failed',
              enrichment_data: { error: 'Website content too short or empty' },
            })
            .eq('id', listing.id);
          failed++;
          continue;
        }

        console.log(`    Extracted ${text.length} chars of text`);

        // Step 2: Send to Claude
        console.log('    Sending to Claude...');
        const extracted = await extractWithClaude(text, listing.name);

        console.log(`    Description: ${(extracted.description || '').slice(0, 80)}...`);
        console.log(`    Languages: ${(extracted.languages || []).join(', ')}`);
        console.log(`    Years: ${extracted.years_in_business || 'unknown'}`);
        console.log(
          `    Specializations: ${(extracted.specializations || []).join(', ')}`
        );

        // Step 3: Update listing
        const updateData = {
          enrichment_status: 'enriched',
          enrichment_data: extracted,
        };

        if (extracted.description) {
          updateData.description = extracted.description;
        }
        if (Array.isArray(extracted.languages) && extracted.languages.length > 0) {
          updateData.languages = extracted.languages;
        }
        if (
          extracted.years_in_business !== null &&
          extracted.years_in_business !== undefined
        ) {
          updateData.years_in_business = parseInt(extracted.years_in_business, 10) || null;
        }

        const { error: updateErr } = await supabase
          .from('mortgage_listings')
          .update(updateData)
          .eq('id', listing.id);

        if (updateErr) {
          throw new Error(`Supabase update error: ${updateErr.message}`);
        }

        // Step 4: Assign specializations
        if (
          Array.isArray(extracted.specializations) &&
          extracted.specializations.length > 0
        ) {
          const specCount = await assignSpecializations(
            listing.id,
            extracted.specializations,
            specMap
          );
          console.log(`    Assigned ${specCount} specializations`);
        }

        enriched++;
        console.log('    Done (enriched)');
      } catch (err) {
        console.error(`    ERROR: ${err.message}`);

        // Mark as failed
        try {
          await supabase
            .from('mortgage_listings')
            .update({
              enrichment_status: 'failed',
              enrichment_data: { error: err.message },
            })
            .eq('id', listing.id);
        } catch (updateErr) {
          console.error(`    Could not mark as failed: ${updateErr.message}`);
        }

        failed++;
      }

      // Rate limit: 2 seconds between requests
      if (i < batch.length - 1 || batchStart + BATCH_SIZE < allPending.length) {
        await sleep(RATE_LIMIT_MS);
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total processed: ${enriched + failed}`);
  console.log(`Enriched:        ${enriched}`);
  console.log(`Failed:          ${failed}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
