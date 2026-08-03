import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Real, Hammart-specific Vendor Terms of Service — written against the
// actual Consumer Protection (E-Commerce) Rules 2020 (Rule 6's duties for
// marketplace e-commerce entities regarding their sellers) and how
// Hammart actually works today (direct buyer-to-vendor UPI payment, no
// InPlayer escrow, real KYC review, the 10-free/₹249-per-month listing
// model). Same honest caveat as app/terms/page.tsx: this is a working
// draft matching the real product, not a substitute for review by a
// lawyer familiar with Indian consumer-protection and IT law before this
// is relied on for compliance at scale.
export const metadata = {
  title: "Vendor Terms — Hammart",
};

const LAST_UPDATED = "30 July 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-black text-white light:text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-slate-300 light:text-slate-700">{children}</div>
    </section>
  );
}

export default function HammartVendorTermsPage() {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-10 sm:py-14">
      <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 light:text-slate-600 hover:text-orange-400">
        <ArrowLeft size={16} /> Back to Hammart
      </Link>

      <h1 className="mt-6 text-3xl font-black text-white light:text-slate-900">Hammart Vendor Terms</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated {LAST_UPDATED}</p>

      <Section title="1. What Hammart is">
        <p>
          Hammart is a marketplace feature of InPlayer where independent vendors — individuals or registered
          businesses — list and sell products directly to InPlayer users. InPlayer operates the listing platform,
          vendor verification, and buyer-facing storefront, but is not a party to the sale itself: every purchase is a
          direct transaction between you (the vendor) and the buyer.
        </p>
      </Section>

      <Section title="2. Becoming a verified vendor">
        <p>
          Before you can publish a listing, you must complete Hammart&apos;s business-KYC review: your legal name,
          PAN, and (for a registered business) GST or Udyam registration number, plus bank/UPI details, reviewed by a
          real person on the InPlayer team. We may reject or request corrections to any submission. Approval doesn&apos;t
          guarantee any particular sales outcome.
        </p>
      </Section>

      <Section title="3. Accurate, honest listings — Rule 6, Consumer Protection (E-Commerce) Rules 2020">
        <p>Every listing you publish must:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Accurately describe the product — its features, condition, and any material defects. No misleading titles, descriptions, or photos.</li>
          <li>Show the total price, including any charges that apply — no hidden costs revealed only after purchase.</li>
          <li>State the country of origin and, where applicable, any expiry date, warranty, or guarantee that applies.</li>
          <li>Never claim a fake review, fake rating, or false endorsement.</li>
          <li>Never list a banned item — see Section 6.</li>
        </ul>
        <p>
          You are legally responsible for the accuracy of your own listings under the Consumer Protection Act, 2019
          and the Consumer Protection (E-Commerce) Rules, 2020. InPlayer may remove any listing that appears to
          violate this section without prior notice.
        </p>
      </Section>

      <Section title="4. Payment — direct, vendor-to-buyer, not through InPlayer">
        <p>
          Hammart does not process payments and does not hold or escrow buyer funds. At checkout, a buyer is shown
          your own UPI ID as a QR code and payment link, and pays you directly through their own UPI app. InPlayer
          cannot see, confirm, or reverse this payment — that visibility exists only between you, the buyer, and your
          bank/UPI provider. You are responsible for confirming payment actually arrived before marking an order
          confirmed and shipping the product.
        </p>
      </Section>

      <Section title="5. Returns, refunds, and cancellations">
        <p>
          You must clearly state your own return, refund, and cancellation policy to buyers (in your listing
          description) and honor it. Regardless of your stated policy, you cannot refuse to accept a return or issue
          a refund for a product that was defective, materially different from its listing, or not delivered — this
          is a legal requirement under Rule 6, not optional. Since InPlayer never holds the payment, any refund is
          one you send directly to the buyer.
        </p>
      </Section>

      <Section title="6. Banned items">
        <p>
          Hammart does not permit listings for: alcohol; tobacco, cigarettes, vapes, or e-cigarettes; sex toys or
          other adult/sexual products; illegal drugs or drug paraphernalia; firearms, ammunition, weapons, or
          explosives; counterfeit or pirated goods; live animals; human body parts or organs; prescription medicines
          without a valid license; and currency or gambling-related items. Every listing is automatically screened
          against this list before publishing, and a match is hidden from buyers and flagged for review. Repeated
          attempts to list banned items may result in suspension of your vendor account.
        </p>
      </Section>

      <Section title="7. Grievance handling">
        <p>
          You must respond to a buyer&apos;s complaint about an order within 48 hours, and work in good faith to
          resolve it within 30 days, consistent with Rule 6&apos;s consumer grievance timelines. InPlayer&apos;s own
          Grievance Officer for Hammart-related complaints can be reached through the contact details listed on our{" "}
          <Link href="/terms" className="font-semibold text-orange-300 hover:underline">
            main Terms of Service
          </Link>
          . InPlayer may step in to remove a listing or suspend a vendor account where a complaint is not resolved in
          good faith.
        </p>
      </Section>

      <Section title="8. Fees & Listing Charges">
        <p>
          Verified vendors enjoy unlimited product listings on the Hammart marketplace. A flat platform listing fee
          of ₹0.50 (50 paise) applies per published product listing. InPlayer does not take a commission on individual
          sales — payments for items are received directly by the vendor.
        </p>
      </Section>

      <Section title="9. Suspension and removal">
        <p>
          InPlayer may suspend your vendor account or remove a listing for a violation of these terms, a violation of
          InPlayer&apos;s general{" "}
          <Link href="/terms" className="font-semibold text-orange-300 hover:underline">
            Terms of Service
          </Link>
          , a credible buyer complaint, or a legal request. Where reasonably possible, we&apos;ll tell you why.
        </p>
      </Section>

      <Section title="10. Taxes and legal compliance">
        <p>
          You are solely responsible for any GST, income tax, or other legal obligations arising from your sales on
          Hammart, including registering for GST if your turnover requires it. InPlayer does not file or remit taxes
          on your behalf.
        </p>
      </Section>

      <Section title="11. Data and privacy">
        <p>
          KYC documents you submit (photos of ID, bank proof, business registration) are reviewed by a human and then
          permanently deleted from our systems — only your legal name, PAN, GST/Udyam number, and bank/UPI details
          remain on file for compliance and support purposes. See InPlayer&apos;s main{" "}
          <Link href="/privacy" className="font-semibold text-orange-300 hover:underline">
            Privacy Policy
          </Link>{" "}
          for how we handle data generally.
        </p>
      </Section>

      <Section title="12. Changes to these terms">
        <p>
          We may update these terms as Hammart evolves. Continuing to use your vendor account after an update means
          you accept the revised terms.
        </p>
      </Section>

      <p className="mt-10 text-xs text-slate-500">
        This document is a working draft written to match how Hammart actually operates and India&apos;s Consumer
        Protection (E-Commerce) Rules, 2020 as we understand them — it has not been reviewed by a lawyer and should
        not be treated as a final, compliance-certified legal document without that review.
      </p>
    </div>
  );
}
