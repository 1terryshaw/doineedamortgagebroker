// Two concerns, in this order: AEO crawler logging (TDL #684 AEO v2) and the
// pre-existing UK host-gate + chrome signal. They are independent; the logging is
// fire-and-forget and can never change a response.
//
// ── 1. AEO v2 — AI bot crawler tracking ────────────────────────────────────────
// Detects AEO / AI-assistant crawlers by User-Agent and fire-and-forget logs the
// hit to Supabase via the log_ai_crawler_hit_v2() RPC (anon key + SECURITY DEFINER
// function — no service-role key at the edge, anon cannot read the table).
// Ported from the fleet canon (cluster B, md5 ec5ac3e7719597025c0dc92053bbdc8b);
// AI_BOTS, the RPC payload and the dedup semantics are unchanged from it.
//
// ZERO added user latency: the network write runs inside event.waitUntil() and is
// never awaited on the response path. Non-bot requests do a single regex test.
//
// WHY vertical_slug IS NOT READ FROM lib/vertical.config.ts LIKE EVERY OTHER REPO
// ------------------------------------------------------------------------------
// This repo has no vertical.config.ts, and — uniquely in the fleet — it builds TWO
// directories from one source, so there is no single registrySlug. The two are
// separate ACTIVE rows in empire_verticals with different primary_domains:
//     NEXT_PUBLIC_COUNTRY=CA -> `mortgage`     (findmymortgagebroker.ca)
//     NEXT_PUBLIC_COUNTRY=US -> `mortgage-us`  (doineedamortgagebroker.com)
// The map is explicit and has NO fallback: an unset/unexpected NEXT_PUBLIC_COUNTRY
// yields null and we log NOTHING, rather than silently filing one brand's traffic
// under the other brand's vertical. A wrong slug is worse than a missing row —
// it is the exact class of error that made the UK cohorts unmeasurable.
//
// We deliberately do NOT import COUNTRY from "@/lib/country": that module THROWS at
// module scope when NEXT_PUBLIC_COUNTRY is unset, which in middleware would take
// down every request on the site. Crawler logging must never be able to do that.
//
// ── 2. UK subtree gate + chrome signal (PRE-EXISTING, BEHAVIOUR UNCHANGED) ─────
// The /uk subtree must be gated at RUNTIME by request host — the build cannot know
// which project is serving it. For /uk and /api/uk paths ONLY:
//   1. HOST-GATE — /uk serves ONLY on doineedamortgagebroker.com (+ *.vercel.app
//      previews and localhost). Any other host (incl. findmymortgagebroker.ca) 404s.
//   2. CHROME SIGNAL — sets `x-uk-pathname` so the root layout can suppress its US
//      chrome and let src/app/uk/layout.tsx supply the FCA-safe chrome instead.
//
// TWO TRAPS THIS MERGE HAD TO AVOID — both would have been silent:
//   (a) The canon matcher is "/((?!api|...).*)", which EXCLUDES /api. Adopting it
//       alone would have dropped /api/uk out of the matcher and QUIETLY REMOVED the
//       host-gate from the UK API routes, exposing them on findmymortgagebroker.ca.
//       The matcher below therefore re-adds /api/uk explicitly.
//   (b) The host-gate previously ran on every matched path because the matcher was
//       /uk-only. With the widened matcher it must be scoped by an explicit pathname
//       test, or it would 404 EVERY path on findmymortgagebroker.ca — a total outage
//       of the CA brand. Hence UK_SCOPE below; non-/uk requests are untouched.

import { NextRequest, NextResponse, NextFetchEvent } from "next/server";

// Canonical UA token → canonical bot_name. Order: most specific first.
// Case-insensitive. MUST stay in sync with the SQL allow-list.
const AI_BOTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/GPTBot/i, "GPTBot"],
  [/ChatGPT-User/i, "ChatGPT-User"],
  [/ClaudeBot/i, "ClaudeBot"],
  [/anthropic-ai/i, "anthropic-ai"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Perplexity-User/i, "Perplexity-User"],
  // NB: Google-Extended is NOT a crawler — it's a robots.txt control token that
  // makes zero HTTP requests, so it would never fire here. The Google UAs that
  // actually crawl are user-triggered Gemini agents:
  [/Google-Agent/i, "Google-Agent"],
  [/Gemini-Deep-Research/i, "Gemini-Deep-Research"],
  [/Applebot-Extended/i, "Applebot-Extended"],
  [/Amazonbot/i, "Amazonbot"],
  [/Bytespider/i, "Bytespider"],
  [/Meta-ExternalAgent/i, "Meta-ExternalAgent"],
  [/CCBot/i, "CCBot"],
  [/YouBot/i, "YouBot"],
  [/cohere-ai/i, "cohere-ai"],
];

// Explicit dict, no prefix rule, no fallback. Null => do not log.
const SLUG_BY_COUNTRY: Readonly<Record<string, string>> = {
  CA: "mortgage",
  US: "mortgage-us",
};
const REGISTRY_SLUG: string | null =
  SLUG_BY_COUNTRY[process.env.NEXT_PUBLIC_COUNTRY ?? ""] ?? null;

// The /uk universe — and ONLY it — is subject to the host-gate and chrome signal.
const UK_SCOPE = /^\/(?:api\/)?uk(?:\/|$)/;

function detectBot(ua: string | null): string | null {
  if (!ua) return null;
  for (const [re, name] of AI_BOTS) {
    if (re.test(ua)) return name;
  }
  return null;
}

// Return a syntactically-valid IPv4/IPv6 string, or null. Guarantees the RPC's
// ::inet cast cannot throw (which would log an rpc_exception → RED gate).
function clientIp(req: NextRequest): string | null {
  const raw =
    req.ip ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  if (!raw) return null;
  const ipv4 =
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
  const ipv6 = /^(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4.test(raw) || ipv6.test(raw) ? raw : null;
}

function hostAllowed(hostHeader: string | null): boolean {
  const host = (hostHeader || "").split(":")[0].toLowerCase();
  if (!host) return false;
  // Only the .com brand's hosts. NOTE: this repo also builds the CA project
  // (findyourmortgagebroker → findmymortgagebroker.ca) from the SAME source, so the
  // predicate must exclude the CA project's own *.vercel.app domain too — hence we
  // require the "doineedamortgagebroker" brand token in the vercel.app host rather than
  // a blanket *.vercel.app (which would also match findyourmortgagebroker.vercel.app).
  if (host === "doineedamortgagebroker.com") return true;
  if (host.endsWith(".doineedamortgagebroker.com")) return true; // www + subdomains
  if (host.includes("doineedamortgagebroker") && host.endsWith(".vercel.app")) return true; // .com preview deploys only
  if (host === "localhost" || host === "127.0.0.1") return true;
  return false; // everything else — findmymortgagebroker.ca AND findyourmortgagebroker.vercel.app — is blocked
}

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  // ── 1. AEO logging. Fire-and-forget; cannot alter the response. Skipped for the
  // /api/uk paths the matcher re-adds, so API traffic stays out of the crawler feed
  // exactly as the canon matcher intends.
  if (REGISTRY_SLUG && !pathname.startsWith("/api")) {
    const ua = req.headers.get("user-agent");
    const bot = detectBot(ua);
    if (bot) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && anon) {
        const body = JSON.stringify({
          p_bot_name: bot,
          p_vertical_slug: REGISTRY_SLUG,
          p_path: pathname,
          // Edge-derived country code only. Undefined locally.
          p_country_inferred: req.geo?.country ?? null,
          // Final render status is unknown at middleware time (no log drains).
          p_status_code: null,
          p_user_agent: ua,
          p_source_ip: clientIp(req),
        });
        event.waitUntil(
          fetch(`${url}/rest/v1/rpc/log_ai_crawler_hit_v2`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anon,
              Authorization: `Bearer ${anon}`,
            },
            body,
            // never let logging interfere with anything; swallow all errors
            keepalive: true,
          }).catch(() => {}),
        );
      }
    }
  }

  // ── 2. UK host-gate + chrome signal. Scoped to the /uk universe; every other
  // path falls straight through, so the CA brand is untouched.
  if (!UK_SCOPE.test(pathname)) {
    return NextResponse.next();
  }

  if (!hostAllowed(req.headers.get("host"))) {
    // 404 on a disallowed host (e.g. findmymortgagebroker.ca). Applies to /uk pages and
    // /api/uk routes alike.
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-uk-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Canon content matcher (AEO) PLUS an explicit re-add of /api/uk, which the canon
// matcher's `(?!api…)` would otherwise drop — taking the host-gate with it.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/api/uk",
    "/api/uk/:path*",
  ],
};
