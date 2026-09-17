import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { JURISDICTION } from "@/lib/jurisdiction";
import Disclaimer from "@/components/Disclaimer";

const TITLE = `${SITE_NAME} | ${JURISDICTION.siteTitleSuffix}`;
const DESCRIPTION = JURISDICTION.siteDescription;

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
  },
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    locale: JURISDICTION.ogLocale,
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  // NO `alternates` HERE (TDL #1241). A layout-level canonical is inherited verbatim
  // by every page that does not override it, so `canonical: SITE_URL` told Google that
  // the listing pages and the city/profession hubs were duplicates of the homepage
  // (Site Surfer 2026-09-16, CANONICAL ×3). Each route now states its own canonical and
  // its own per-path hreflang pair via `selfAlternates()` in src/lib/seo-alternates.ts.
  // A route that forgets emits NO canonical, which Google resolves to self — wrong-by-
  // omission is recoverable, wrong-by-assertion is not.
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // FCA NEUTRALIZATION: the /uk subtree must NOT render the US chrome (the amber
  // <Disclaimer/> "not financial advice / state regulator records" banner, the US
  // <Header/>, or the US <Footer/> whose verify line names NMLS Consumer Access). A
  // nested layout cannot strip a parent layout's siblings, so the root detects /uk via
  // the `x-uk-pathname` header set by src/middleware.ts and renders a bare shell —
  // src/app/uk/layout.tsx then supplies the FCA-safe chrome. Fail OPEN to US chrome if
  // the header is unreadable (never a UK page in that case, since /uk always transits
  // the middleware that sets it).
  let isUk = false;
  try {
    const ukPath = (await headers()).get("x-uk-pathname") ?? "";
    isUk = ukPath === "/uk" || ukPath.startsWith("/uk/");
  } catch {
    isUk = false;
  }

  if (isUk) {
    return (
      <html lang="en-GB">
        <body className="flex min-h-screen flex-col font-sans antialiased">
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Disclaimer />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-navy-800 bg-navy-900/95 backdrop-blur supports-[backdrop-filter]:bg-navy-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 max-md:min-h-11 max-md:min-w-11">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          </div>
          <span className="hidden text-lg font-bold text-white sm:inline-block">
            {SITE_NAME}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/search" className="nav-link">
            Search
          </Link>
          <Link href="/owner/login" className="nav-link">
            Owner Login
          </Link>
          <Link href="/claim" className="nav-link">
            Claim Listing
          </Link>
          <Link href="/owner/login" className="btn-primary text-sm">
            Login
          </Link>
        </nav>

        <MobileMenuButton />
      </div>
    </header>
  );
}

function MobileMenuButton() {
  return (
    <div className="md:hidden">
      <Link
        href="/claim"
        className="mr-3 inline-flex min-h-11 min-w-11 items-center justify-center text-xs font-medium text-navy-200 hover:text-white"
      >
        Claim
      </Link>
      <Link
        href="/search"
        className="mr-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-navy-200 hover:text-white"
        aria-label="Search"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </Link>
      <Link href="/owner/login" className="btn-primary min-h-11 px-3 py-1.5 text-xs">
        Login
      </Link>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-navy-800 bg-navy-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                  />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">{SITE_NAME}</span>
            </Link>
            <p className="mt-3 text-sm text-navy-400">
              {JURISDICTION.footerTagline}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy-200">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/search" className="footer-link">
                  Find a Broker
                </Link>
              </li>
              <li>
                <Link href="/search?sort=rating" className="footer-link">
                  Top Rated Brokers
                </Link>
              </li>
              <li>
                <Link href="/owner/login" className="footer-link">
                  Owner Login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy-200">
              {JURISDICTION.browseHeading}
            </h3>
            <ul className="mt-4 space-y-2">
              {JURISDICTION.popularPlaces.map((place) => (
                <li key={place.href}>
                  <Link href={place.href} className="footer-link">
                    {place.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy-200">
              Company
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/about" className="footer-link">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="footer-link">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="footer-link">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="footer-link">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/*
          Related Directories (insurance-us-city-hubs-seo-v1). Reciprocal link —
          doineedaninsurancebroker.com now carries "Find a Mortgage Broker" pointing
          back here. US-ONLY on purpose: this repo renders BOTH the .com (COUNTRY=US)
          and findmymortgagebroker.ca (COUNTRY=CA) from one codebase, and the mission
          scope is US, so the CA surface stays byte-identical.
        */}
        {JURISDICTION.country === "US" && (
          <div className="mt-10 border-t border-navy-800 pt-6 text-center text-sm">
            <span className="text-navy-400">Related directories: </span>
            <a
              href="https://www.doineedaninsurancebroker.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Find an Insurance Broker
            </a>
          </div>
        )}

        <div className="mt-10 border-t border-navy-800 pt-6 text-center text-sm text-navy-500">
          <p>
            &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <p className="mt-2 max-w-3xl mx-auto">
            {JURISDICTION.footerVerifyLine}
          </p>
        </div>
      </div>
    </footer>
  );
}
