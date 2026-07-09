import type { Metadata } from "next";
import Link from "next/link";

// /uk not-found boundary. Its presence makes every notFound() thrown by a /uk route
// (missing county/town/firm, bad slug) render HERE — inside src/app/uk/layout.tsx's
// FCA-safe chrome and under the UK segment metadata — instead of bubbling to the root
// 404, which would inherit the US metadata default and US chrome.
export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default function UkNotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-3 text-gray-600">
        We couldn&apos;t find that page. It may have moved, or the firm may not yet be
        published in our UK directory.
      </p>
      <Link
        href="/uk"
        className="inline-block mt-6 text-sm text-teal-700 hover:underline"
      >
        ← Back to UK Mortgage Brokers
      </Link>
    </div>
  );
}
