import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";
import { JURISDICTION } from "@/lib/jurisdiction";

export const metadata: Metadata = {
  title: `Contact | ${SITE_NAME}`,
  description: `Contact ${SITE_NAME} — report incorrect listings, request removal, or ask a question about the directory.`,
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-navy-900">Contact</h1>
      <div className="prose prose-navy mt-6 max-w-none text-navy-700">
        <p>For questions, listing corrections, removal requests, or media inquiries:</p>
        <p className="mt-4">
          <strong>Email:</strong>{" "}
          <a
            href="mailto:hello@doineedamortgagebroker.com"
            className="text-teal-600 underline"
          >
            hello@doineedamortgagebroker.com
          </a>
        </p>
        <h2 className="mt-8 text-xl font-semibold text-navy-900">
          Are you a licensed broker?
        </h2>
        <p>
          Claim your free listing instead of emailing — claiming gives you
          direct edit access without manual review delays.
        </p>
        <h2 className="mt-8 text-xl font-semibold text-navy-900">
          Removal requests
        </h2>
        <p>
          If you are listed and want your record removed, email the address
          above with the listing URL and a copy of your {JURISDICTION.removalIdProof}. We will
          process the request within 5 business days.
        </p>
      </div>
    </div>
  );
}
