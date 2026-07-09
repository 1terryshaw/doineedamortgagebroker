// src/app/uk/layout.tsx — FCA-SAFE ROUTE-GROUP CHROME for the /uk subtree.
//
// The root src/app/layout.tsx SUPPRESSES its US chrome (<Disclaimer/> + US <Header/> +
// US <Footer/>) for any /uk path — it detects /uk via the `x-uk-pathname` request header
// set by src/middleware.ts and renders a bare <body>{children}</body>. This layout then
// supplies the ONLY chrome a /uk page ever shows: a UK header, the FCA-safe disclaimer
// banner, and a UK footer. No NMLS / state-regulator / Consumer Access / CSBS strings,
// no US MORTGAGE_TYPES, no US popular-cities — nothing US-regulatory can render here.
//
// Host-gating (/uk serves only on doineedamortgagebroker.com, 404 on findmymortgagebroker.ca)
// is enforced in src/middleware.ts, which hard-404s /uk + /api/uk on a disallowed host.
import type { Metadata } from "next";
import Link from "next/link";
import { UK_BRAND, UK_PRIMARY_COLOR } from "@/lib/uk-mortgage";

const FCA_REGISTER_URL = "https://register.fca.org.uk/";

// UK segment metadata DEFAULT. Overrides the root layout's US default (JURISDICTION
// siteDescription/title, which name "loan originator", "state regulator", "not financial
// advice") for every /uk route — most importantly any route that sets no metadata of its
// own (the /uk not-found boundary), so no US-regulatory copy can reach a /uk <head>.
export const metadata: Metadata = {
  title: {
    default: `UK Mortgage Brokers | ${UK_BRAND}`,
    template: `%s | ${UK_BRAND}`,
  },
  description:
    "A directory of FCA-authorised mortgage brokers in the United Kingdom, sourced from Companies House and the FCA Financial Services Register.",
  openGraph: {
    title: `UK Mortgage Brokers | ${UK_BRAND}`,
    description:
      "A directory of FCA-authorised mortgage brokers in the United Kingdom.",
    siteName: UK_BRAND,
    locale: "en_GB",
    type: "website",
  },
  twitter: { card: "summary" },
};

export default function UkLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* UK header — brand only, no US owner-login/search chrome */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/uk" className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ backgroundColor: UK_PRIMARY_COLOR }}
            >
              UK
            </span>
            <span className="text-base font-bold text-gray-900">{UK_BRAND}</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/uk" className="text-gray-600 hover:text-gray-900">
              Find a Broker
            </Link>
            <a
              href={FCA_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900"
            >
              FCA Register
            </a>
          </nav>
        </div>
      </header>

      {/* FCA-safe disclaimer banner (DRAFT — pending compliance sign-off at 1.C).
          Directory of FCA-authorised firms; not itself authorised; does not advise or
          arrange; links to the FCA Register. The standard UK "your home may be
          repossessed" risk warning is intentionally NOT asserted here — it is raised as
          a compliance-review question in the 1.C report, not stamped pre-sign-off. */}
      <div
        role="note"
        aria-label="Directory disclaimer"
        className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-center text-xs text-gray-600 sm:px-6"
      >
        <span className="font-semibold text-gray-800">This is a directory.</span>{" "}
        {UK_BRAND} lists FCA-authorised mortgage firms but is not itself authorised or
        regulated by the Financial Conduct Authority, and does not provide, advise on, or
        arrange mortgages. Always confirm a firm&apos;s current permissions on the{" "}
        <a
          href={FCA_REGISTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-900"
        >
          FCA Register
        </a>{" "}
        before engaging.
      </div>

      <main className="flex-1">{children}</main>

      {/* UK footer — no US popular-cities, no NMLS/verify line */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-base font-bold text-gray-900">{UK_BRAND}</span>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                A directory of FCA-authorised mortgage brokers in the United Kingdom,
                sourced from the Companies House register and the FCA Financial Services
                Register.
              </p>
            </div>
            <nav className="flex flex-wrap gap-4 text-sm text-gray-600">
              <Link href="/uk" className="hover:text-gray-900">
                Home
              </Link>
              <Link href="/uk/privacy" className="hover:text-gray-900">
                Privacy &amp; Marketing
              </Link>
              <a
                href={FCA_REGISTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900"
              >
                FCA Register
              </a>
            </nav>
          </div>
          <div className="mt-8 border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
            <p>
              &copy; {new Date().getFullYear()} {UK_BRAND}. Listings reflect publicly
              available Companies House and FCA Register data and may not reflect a
              firm&apos;s current authorisation status. Inclusion does not imply
              endorsement.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
