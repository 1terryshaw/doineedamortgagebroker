import { NextRequest, NextResponse } from "next/server";

// UK subtree gate + chrome signal. This repo builds BOTH doineedamortgagebroker.com (US)
// and findmymortgagebroker.ca (CA) from the same source, differentiated only by the
// build-time NEXT_PUBLIC_COUNTRY env var. The /uk subtree must therefore be gated at
// RUNTIME by request host — the build cannot know which project is serving it.
//
// This middleware does two things, ONLY for /uk and /api/uk paths:
//   1. HOST-GATE — /uk serves ONLY on doineedamortgagebroker.com (+ *.vercel.app previews
//      and localhost for verification). Any other host (incl. findmymortgagebroker.ca)
//      gets a 404. country.ts is NOT touched.
//   2. CHROME SIGNAL — sets the `x-uk-pathname` request header so the root layout can
//      suppress its US chrome (<Disclaimer/> + US <Header/>/<Footer/>) and let
//      src/app/uk/layout.tsx supply the FCA-safe chrome instead.
// Non-/uk requests are untouched (plain NextResponse.next()), so the US/CA site is
// unaffected.

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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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

// Scope the middleware to the /uk universe only — the US/CA routes never enter it.
export const config = {
  matcher: ["/uk", "/uk/:path*", "/api/uk", "/api/uk/:path*"],
};
