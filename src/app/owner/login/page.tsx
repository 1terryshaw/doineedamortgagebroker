import { Metadata } from "next";
import LoginForm from "@/components/LoginForm";
import { selfAlternates } from "@/lib/seo-alternates";

export const metadata: Metadata = {
  title: "Owner Login",
  alternates: selfAlternates("/owner/login"),
};

export default function OwnerLoginPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <LoginForm />
    </div>
  );
}
