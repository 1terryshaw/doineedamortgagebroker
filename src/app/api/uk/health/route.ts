import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { UK_TABLE, COUNTY_STATS_VIEW } from "@/lib/uk-mortgage";

export const dynamic = "force-dynamic";

// Dedicated UK health probe — kept separate from the US/CA health surface so the two
// markets are independently observable. Reads ONLY uk_mortgage_brokers + its stat view.
export async function GET() {
  const checks: Record<string, string> = {};

  let total = 0;
  let published = 0;
  try {
    const totalRes = await supabaseAdmin.from(UK_TABLE).select("*", { count: "exact", head: true });
    if (totalRes.error) {
      checks.uk_mortgage_brokers = `error: ${totalRes.error.message}`;
    } else {
      total = totalRes.count || 0;
      const pubRes = await supabaseAdmin
        .from(UK_TABLE)
        .select("*", { count: "exact", head: true })
        .eq("is_published", true);
      published = pubRes.count || 0;
      checks.uk_mortgage_brokers = total > 0 ? "connected" : "EMPTY";
    }
  } catch (e) {
    checks.uk_mortgage_brokers = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  // Stat views back the geo hubs.
  try {
    const { error } = await supabaseAdmin
      .from(COUNTY_STATS_VIEW)
      .select("county", { count: "exact", head: true });
    checks.stat_views = error ? `error: ${error.message}` : "ok";
  } catch (e) {
    checks.stat_views = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const optionalEnvVars = ["NEXT_PUBLIC_BASE_URL", "NEXT_PUBLIC_SITE_URL", "RESEND_API_KEY"];
  for (const key of requiredEnvVars) checks[key] = process.env[key] ? "set" : "MISSING";
  for (const key of optionalEnvVars) checks[key] = process.env[key] ? "set" : "not set";

  const allRequiredSet = requiredEnvVars.every((k) => process.env[k]);
  const supabaseOk = checks.uk_mortgage_brokers === "connected" || checks.uk_mortgage_brokers === "EMPTY";

  return NextResponse.json({
    status: allRequiredSet && supabaseOk ? "healthy" : "degraded",
    vertical: "mortgage_uk",
    listings_table: UK_TABLE,
    total,
    published,
    checks,
    timestamp: new Date().toISOString(),
  });
}
