import { redirect } from "next/navigation";

// Merged into the single InPlayer Policies hub (app/policies/page.tsx) —
// this route stays alive as a redirect rather than being deleted, since
// it's hardcoded in VendorKycForm.tsx's onboarding consent checkbox,
// TermsSection.tsx's cross-link, Navbar.tsx, Footer.tsx, and the sitemap.
export const metadata = {
  title: "Vendor Terms — Hammart",
};

export default function HammartVendorTermsPage() {
  redirect("/policies?tab=vendor-terms");
}
