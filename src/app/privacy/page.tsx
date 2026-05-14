import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `Privacy Policy for ${SITE_NAME} — including CCPA disclosures.`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-navy-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-navy-500">Last updated: 2026-05-14</p>
      <div className="prose prose-navy mt-6 max-w-none text-navy-700">
        <h2 className="text-xl font-semibold text-navy-900">What we collect</h2>
        <ul className="mt-3 list-disc pl-6">
          <li>
            <strong>Directory data:</strong> Names, NMLS IDs, business
            addresses, license numbers, phone numbers, and license status for
            mortgage brokers. Sourced from public state regulator records.
          </li>
          <li>
            <strong>Account data:</strong> If you claim a listing, we collect
            your email address and any contact information you choose to
            update on your listing.
          </li>
          <li>
            <strong>Inquiry data:</strong> If you submit an inquiry through a
            listing, the broker receives your name, email, phone (optional),
            and message.
          </li>
          <li>
            <strong>Usage data:</strong> Standard server logs (IP, user agent,
            referrer, timestamp).
          </li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">How we use it</h2>
        <p>
          To operate the directory, route inquiries to brokers, prevent abuse,
          and improve the service. We do not sell your personal information.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">
          California Privacy Rights (CCPA / CPRA)
        </h2>
        <p>
          California residents have the right to: (a) know what personal
          information we collect, (b) request deletion of personal
          information, (c) opt out of any &ldquo;sale&rdquo; or
          &ldquo;sharing&rdquo; of personal information, and (d) be free from
          discrimination for exercising these rights.
        </p>
        <p>
          We do not sell personal information. To exercise any CCPA right,
          email{" "}
          <a
            href="mailto:privacy@doineedamortgagebroker.com"
            className="text-teal-600 underline"
          >
            privacy@doineedamortgagebroker.com
          </a>{" "}
          with the subject line &ldquo;CCPA Request&rdquo; and we will respond
          within 45 days.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">
          Removing your listing
        </h2>
        <p>
          If you are listed and want your record removed, see the{" "}
          <a href="/contact" className="text-teal-600 underline">
            Contact
          </a>{" "}
          page. We will remove the listing within 5 business days.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">Cookies</h2>
        <p>
          We use only essential cookies for authentication. No advertising or
          tracking cookies are set by us.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">Children</h2>
        <p>This site is not directed to children under 13.</p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">Contact</h2>
        <p>
          Privacy questions:{" "}
          <a
            href="mailto:privacy@doineedamortgagebroker.com"
            className="text-teal-600 underline"
          >
            privacy@doineedamortgagebroker.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
