import { redirect } from "next/navigation";

// Deprecated (TDL #624 owner-token cutover). Owner accounts are now claimed via
// /claim/{slug} and authenticated via the magic-link /owner/login. Kept as a
// redirect so old bookmarks / outreach links don't 404.
export default function SignupPage() {
  redirect("/owner/login");
}
