import { Metadata } from "next";
import Link from "next/link";
import { selfAlternates } from "@/lib/seo-alternates";
import { NAME_EMAIL_REASON, NAME_EMAIL_MESSAGE } from "@/lib/name-email-guard";

export const metadata: Metadata = {
  title: "Claim Error",
  alternates: selfAlternates("/claim/error"),
};

interface Props {
  // name-guard-followthrough-v1 (K395 R1): /api/claim/verify adds ?reason=name_email when the
  // claim write was refused by the name-email guard.
  searchParams: Promise<{ reason?: string }>;
}

export default async function ClaimErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const nameEmail = reason === NAME_EMAIL_REASON;
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-4">Verification Failed</h1>
      <p className="text-gray-600 mb-6">
        {nameEmail
          ? NAME_EMAIL_MESSAGE
          : "The verification link is invalid or has expired. Please try claiming your listing again."}
      </p>
      <Link href="/search" className="text-blue-600 hover:underline">
        Back to directory
      </Link>
    </div>
  );
}
