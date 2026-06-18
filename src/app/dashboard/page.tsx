import { redirect } from "next/navigation";

// Deprecated (TDL #624 owner-token cutover). The owner dashboard is now the
// magic-link portal at /owner/{slug}; this route redirects to the owner login.
export default function DashboardPage() {
  redirect("/owner/login");
}
