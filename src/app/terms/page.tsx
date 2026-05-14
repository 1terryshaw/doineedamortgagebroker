import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Terms of Service | ${SITE_NAME}`,
  description: `Terms of Service for ${SITE_NAME} — a US mortgage broker directory.`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-navy-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-navy-500">Last updated: 2026-05-14</p>
      <div className="prose prose-navy mt-6 max-w-none text-navy-700">
        <h2 className="text-xl font-semibold text-navy-900">1. Not financial advice</h2>
        <p>
          {SITE_NAME} is a directory. Nothing on this site constitutes
          financial, mortgage, legal, or tax advice. Mortgage decisions should
          be made with a licensed professional appropriate to your
          jurisdiction and circumstances.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">2. Data accuracy</h2>
        <p>
          Listings are sourced from public state regulator records. License
          status, contact information, and licensure details can change without
          notice. Always independently verify a broker&apos;s license on{" "}
          <a
            href="https://www.nmlsconsumeraccess.org/"
            className="text-teal-600 underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            NMLS Consumer Access
          </a>
          .
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">3. No endorsement</h2>
        <p>
          Inclusion in our directory does not constitute an endorsement,
          recommendation, certification, or warranty by {SITE_NAME}.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">4. User-submitted content</h2>
        <p>
          Reviews, claim submissions, and inquiries you submit may be displayed
          publicly. Do not submit confidential information or anything you
          would not want publicly indexed.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">5. Limitation of liability</h2>
        <p>
          {SITE_NAME} is provided &ldquo;as is&rdquo; without warranties of any
          kind. To the maximum extent permitted by law, we disclaim liability
          for any damages arising from your use of this site or reliance on the
          information it contains.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">6. Governing law</h2>
        <p>
          These terms are governed by the laws of the United States and the
          State of Florida, without regard to conflict-of-laws principles.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">7. Changes</h2>
        <p>
          We may update these Terms periodically. Continued use of the site
          constitutes acceptance of the current Terms.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-navy-900">8. Contact</h2>
        <p>
          Questions about these Terms:{" "}
          <a
            href="mailto:hello@doineedamortgagebroker.com"
            className="text-teal-600 underline"
          >
            hello@doineedamortgagebroker.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
