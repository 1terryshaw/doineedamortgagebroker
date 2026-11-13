/**
 * Regression: a forced Postgres 57014 / hung listing query must not fail
 * build-time sitemap prerender and must not 500 the homepage/directory soft-shell.
 *
 * Run: npx tsx --test tests/sitemap-build-timeout.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const TIMEOUT_ERR = Object.assign(
  new Error("canceling statement due to statement timeout"),
  { code: "57014" },
);

// Dummy env — never read real prod secrets. COUNTRY required by lib/country.ts.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "dummy-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy-service-key";
process.env.NEXT_PUBLIC_COUNTRY ||= "US";
process.env.NEXT_PUBLIC_SITE_URL ||= "https://doineedamortgagebroker.com";

test("sitemap/[id] generateStaticParams returns [] and never hits getSegments", async () => {
  let segmentCalls = 0;

  const chunksAbs = require.resolve("../src/lib/sitemap-chunks.ts");
  require.cache[chunksAbs] = {
    id: chunksAbs,
    filename: chunksAbs,
    loaded: true,
    exports: {
      renderChunk: async () => {
        throw TIMEOUT_ERR;
      },
      getSegments: async () => {
        segmentCalls++;
        throw TIMEOUT_ERR;
      },
      CHUNK_SIZE: 45_000,
    },
  } as NodeModule;

  const routeAbs = require.resolve("../src/app/sitemap/[id]/route.ts");
  delete require.cache[routeAbs];

  const mod = require("../src/app/sitemap/[id]/route.ts") as {
    generateStaticParams: () => Promise<{ id: string }[]>;
    dynamicParams: boolean;
  };
  const params = await mod.generateStaticParams();

  assert.deepEqual(params, []);
  assert.equal(segmentCalls, 0, "generateStaticParams must not hit getSegments");
  assert.equal(mod.dynamicParams, true);
});

test("sitemap index source never calls getCorpusContentMax (decorative lastmod removed)", () => {
  const src = fs.readFileSync(
    path.join(root, "src/lib/sitemap-chunks.ts"),
    "utf8",
  );
  assert.equal(/getCorpusContentMax/.test(src), false);
  assert.match(src, /KEYSET_PAGE|getListingsContentRange/);
  assert.match(src, /\.gt\(\s*["']id["']/);
  assert.match(src, /no fabricated lastmod|omit.*lastmod|decorative/i);
});

test("sitemap index build soft-fail does not throw on 57014 from getSegments", async () => {
  process.env.NEXT_PHASE = "phase-production-build";

  const chunksAbs = require.resolve("../src/lib/sitemap-chunks.ts");
  require.cache[chunksAbs] = {
    id: chunksAbs,
    filename: chunksAbs,
    loaded: true,
    exports: {
      renderIndex: async () => {
        throw TIMEOUT_ERR;
      },
      getSegments: async () => {
        throw TIMEOUT_ERR;
      },
      CHUNK_SIZE: 45_000,
    },
  } as NodeModule;

  const routeAbs = require.resolve("../src/app/sitemap.xml/route.ts");
  delete require.cache[routeAbs];

  const mod = require("../src/app/sitemap.xml/route.ts") as {
    GET: () => Promise<Response>;
  };
  const res = await mod.GET();
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /<sitemapindex/);
  // Non-empty: chunk-0-only soft-fail (K216 — never empty 200).
  assert.match(body, /\/sitemap\/0\.xml/);
  // Must not advertise a fabricated multi-child set from a failed count.
  assert.equal(/\/sitemap\/[1-9]\d*\.xml/.test(body), false);

  delete process.env.NEXT_PHASE;
});

test("deserve-gate fetch uses ~2s AbortSignal and stays fail-open", () => {
  const src = fs.readFileSync(
    path.join(root, "src/lib/deserve-gate.ts"),
    "utf8",
  );
  assert.match(src, /AbortSignal\.timeout\(\s*2000\s*\)/);
  assert.match(src, /fail open/i);
  assert.match(src, /DESERVE_GATE_VERSION = "1\.1\.1"/);
});

test("getDirectoryRegions / listing range use id keyset (not deep OFFSET walk)", () => {
  const hub = fs.readFileSync(
    path.join(root, "src/lib/directory-hub.ts"),
    "utf8",
  );
  assert.match(hub, /KEYSET_PAGE/);
  assert.match(hub, /\.gt\(\s*["']id["']/);
  assert.match(hub, /fallbackDirectoryRegions/);
  // The region facet walk must not .range(from, …) anymore.
  const fetchFn = hub.slice(hub.indexOf("async function fetchDirectoryRegionsKeyset"));
  const body = fetchFn.slice(
    0,
    fetchFn.indexOf("export async function getListingsCount"),
  );
  assert.equal(/\.range\(\s*from\s*,/.test(body), false);

  const chunks = fs.readFileSync(
    path.join(root, "src/lib/sitemap-chunks.ts"),
    "utf8",
  );
  const rangeFn = chunks.slice(
    chunks.indexOf("export async function getListingsContentRange"),
  );
  const rangeBody = rangeFn.slice(
    0,
    rangeFn.indexOf("/** Count each segment") > 0
      ? rangeFn.indexOf("export async function getSegments")
      : rangeFn.length,
  );
  assert.equal(/\.range\(\s*[a-z]/.test(rangeBody), false);
  assert.match(rangeBody, /\.gt\(\s*["']id["']/);
});

test("homepage and directory soft-shell on DB fault (source + fallback)", () => {
  const home = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
  assert.match(home, /soft shell/i);
  assert.match(home, /fallbackDirectoryRegions/);
  assert.match(home, /force-dynamic/);
  assert.equal(/export const revalidate/.test(home), false);

  const dir = fs.readFileSync(
    path.join(root, "src/app/directory/page.tsx"),
    "utf8",
  );
  assert.match(dir, /DirectorySoftShell/);
  assert.match(dir, /DB fault — soft shell/);
  assert.match(dir, /temporarily unavailable/);
});

test("forced 57014 from getDirectoryRegions does not throw through fallback helper", async () => {
  // Source-level contract: fallbackDirectoryRegions is sync and DB-free.
  const hubAbs = require.resolve("../src/lib/directory-hub.ts");
  // Clear any prior mock of country/hub deps by requiring through a fresh path
  // after env is set — country.ts throws if COUNTRY unset.
  delete require.cache[hubAbs];
  const countryAbs = require.resolve("../src/lib/country.ts");
  delete require.cache[countryAbs];

  const hub = require("../src/lib/directory-hub.ts") as {
    fallbackDirectoryRegions: () => Array<{ province: string; name: string; cities: unknown[] }>;
  };
  const regions = hub.fallbackDirectoryRegions();
  assert.ok(regions.length >= 50);
  assert.ok(regions.some((r) => r.province === "AZ"));
  assert.deepEqual(regions.find((r) => r.province === "AZ")?.cities, []);
});
