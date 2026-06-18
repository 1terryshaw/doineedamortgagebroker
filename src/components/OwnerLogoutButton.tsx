"use client";

import { useRouter } from "next/navigation";

export default function OwnerLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/owner/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-sm text-gray-500 hover:text-gray-800 underline"
    >
      Log out
    </button>
  );
}
