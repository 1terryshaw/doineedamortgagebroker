import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import { JURISDICTION } from "@/lib/jurisdiction";

export const metadata: Metadata = {
  title: `About | ${SITE_NAME}`,
  description: `${SITE_NAME} is ${JURISDICTION.directoryScope} of licensed mortgage brokers and loan originators sourced from ${JURISDICTION.regulatorRecords}.`,
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-navy-900">About {SITE_NAME}</h1>
      <div className="prose prose-navy mt-6 max-w-none text-navy-700">
        <p>
          {SITE_NAME} is a directory of licensed mortgage brokers, loan
          originators, and mortgage broker firms in {JURISDICTION.countryName}. We
          source listings from {JURISDICTION.regulatorRecords}
          {JURISDICTION.regulatorRecordsParen}.
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
            Built on publicly available {JURISDICTION.country === "US" ? "state" : "provincial"} regulator data, refreshed on
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
            Not affiliated with {JURISDICTION.notAffiliated}. We
            consume their public data.
          </li>
        </ul>
        <h2 className="mt-8 text-xl font-semibold text-navy-900">
          Verifying a license
        </h2>
        <p>
          Always verify a broker&apos;s current license status on{" "}
          <a
            href={JURISDICTION.verifyRegistry.url}
            className="text-teal-600 underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {JURISDICTION.verifyRegistry.name}
          </a>{" "}
          {JURISDICTION.verifyTrailer}
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
