import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `About | ${SITE_NAME}`,
  description: `${SITE_NAME} is a US directory of licensed mortgage brokers and loan originators sourced from official state regulator records.`,
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-navy-900">About {SITE_NAME}</h1>
      <div className="prose prose-navy mt-6 max-w-none text-navy-700">
        <p>
          {SITE_NAME} is a directory of licensed mortgage brokers, loan
          originators, and mortgage broker firms in the United States. We
          source listings from official state regulator records (NMLS-linked
          state agencies that publish their licensee rosters publicly).
        </p>
        <h2 className="mt-8 text-xl font-semibold text-navy-900">
          What we are
        </h2>
        <ul className="mt-3 list-disc pl-6">
          <li>A search and reference directory for borrowers.</li>
          <li>
            A platform where licensed brokers can claim and maintain their
            own listing.
          </li>
          <li>
            Built on publicly available state regulator data, refreshed on
            the cadence the source agencies publish.
          </li>
        </ul>
        <h2 className="mt-8 text-xl font-semibold text-navy-900">
          What we are NOT
        </h2>
        <ul className="mt-3 list-disc pl-6">
          <li>
            Not a licensed financial advisor. Nothing on this site is
            financial advice.
          </li>
          <li>Not a lender. We do not originate or fund mortgage loans.</li>
          <li>
            Not affiliated with NMLS, CSBS, or any state regulator. We
            consume their public data.
          </li>
        </ul>
        <h2 className="mt-8 text-xl font-semibold text-navy-900">
          Verifying a license
        </h2>
        <p>
          Always verify a broker&apos;s current license status on{" "}
          <a
            href="https://www.nmlsconsumeraccess.org/"
            className="text-teal-600 underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            NMLS Consumer Access
          </a>{" "}
          before engaging. License status changes — our snapshot reflects the
          most recent state regulator publication and may be out of date.
        </p>
        <p className="mt-8">
          <Link href="/contact" className="text-teal-600 underline">
            Contact us
          </Link>{" "}
          to flag a stale or incorrect listing.
        </p>
      </div>
    </div>
  );
}
