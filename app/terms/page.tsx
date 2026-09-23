import { redirect } from "next/navigation";

// Merged into the single InPlayer Policies hub (app/policies/page.tsx) —
// this route stays alive as a redirect rather than being deleted, since
// it's hardcoded in a lot of places that should keep working untouched:
// SignUpModal.tsx's consent disclaimer, TermsAcceptanceModal.tsx's
// accept/reject gate, AboutSection.tsx, Navbar.tsx, Footer.tsx, and the
// sitemap.
export const metadata = {
  title: "Terms of Service — InPlayer",
};

export default function TermsPage() {
  redirect("/policies?tab=terms");
}
