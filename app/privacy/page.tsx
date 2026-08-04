import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Real, InPlayer-specific Privacy Policy — see the note in app/terms/page.tsx:
// this reflects how InPlayer actually collects and uses data today, but is
// a working draft, not a substitute for legal review before this goes live
// to real users (especially given InPlayer allows signups from age 13+).
export const metadata = {
  title: "Privacy Policy — InPlayer",
};

const LAST_UPDATED = "4 August 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-black text-white light:text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-slate-300 light:text-slate-700">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 light:text-slate-600 hover:text-orange-400"
      >
        <ArrowLeft size={16} /> Back to InPlayer
      </Link>

      <h1 className="mt-6 text-3xl font-black text-white light:text-slate-900">
        Privacy Policy
      </h1>
      <p className="mt-1 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6 text-sm leading-6 text-slate-300 light:text-slate-700">
        This explains what information InPlayer collects, why, and what control you have over
        it.
      </p>

      <Section title="1. What we collect">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-white light:text-slate-900">Account info:</strong> your
            email, name, and age (used only to confirm you&apos;re 13+) when you sign up.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Profile info:</strong> anything
            you choose to add — avatar, cover photo, username, bio, social links.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Content:</strong> the videos,
            Shorts, comments, and direct messages you post.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Activity:</strong> what you
            watch, like, subscribe to, and search for, so we can show you relevant recommendations
            and let you access your own watch history.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Technical info:</strong> basic
            device and usage data (like error logs) used to keep the service running.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Payment info:</strong> if you
            subscribe to InPlayer Premium or a HamMart vendor plan, or buy a HamMart product, your
            payment details are collected and processed directly by Razorpay — see
            &quot;Who we share data with&quot; below. InPlayer never sees or stores your card,
            UPI, or bank details itself.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">HamMart vendor info:</strong> if
            you register as a HamMart vendor, we collect the business details and identity/KYC
            documents (such as a PAN or Aadhaar-based ID) required to verify you as a seller, plus
            your product listings and order history.
          </li>
        </ul>
      </Section>

      <Section title="2. How we use it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>To run your account and let you use InPlayer&apos;s features</li>
          <li>To recommend videos and Shorts you might like</li>
          <li>
            To automatically scan new comments, messages, and upload titles/descriptions for
            policy violations (see &quot;Automated moderation&quot; below)
          </li>
          <li>To respond to support requests and enforce our Terms of Service</li>
          <li>To improve InPlayer&apos;s features and fix problems</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </Section>

      <Section title="3. Automated moderation">
        <p>
          When you post a comment, send a direct message, or upload a video/Short, the text is
          automatically checked against a third-party content moderation service (OpenAI&apos;s
          Moderation API) for likely policy violations — hate speech, harassment, violence,
          sexual content, and similar categories. Only the text itself is sent for this check;
          nothing else about your account is shared with that service. Content flagged as a
          likely violation is hidden immediately, pending review by an InPlayer admin.
        </p>
      </Section>

      <Section title="4. Who we share data with">
        <p>We use a small number of service providers to run InPlayer, each only for its purpose:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-white light:text-slate-900">Amazon Web Services (AWS)</strong>{" "}
            — hosts our database and authentication (sign-in).
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Mux</strong> — hosts and streams
            video/Short files.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">OpenAI</strong> — the automated
            moderation check described above, and (separately) AI-assisted creative tools like
            thumbnail generation, which you trigger yourself.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Google</strong> — if you choose
            &quot;Continue with Google&quot; to sign in.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Vercel</strong> — hosts the
            InPlayer website itself.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Razorpay</strong> — processes
            payments for Premium subscriptions, HamMart vendor plans, and HamMart product
            purchases. Razorpay receives your payment details directly (card/UPI/bank info);
            InPlayer only receives confirmation that a payment succeeded, not the underlying
            payment details.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Amazon SES</strong> — sends
            account emails (verification codes, notifications) on our behalf.
          </li>
        </ul>
        <p>
          If you buy a product on HamMart, the vendor you bought from also receives what they
          need to fulfil your order (such as your shipping details and order contents) — see
          &quot;Buying and selling on HamMart&quot; in our{" "}
          <Link href="/terms" className="text-orange-400 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </Section>

      <Section title="5. Your choices">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-white light:text-slate-900">Edit or remove content:</strong>{" "}
            delete your own videos, Shorts, comments, and messages any time.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Privacy settings:</strong>{" "}
            control who sees your username and profile from Settings → Account &amp; Privacy.
          </li>
          <li>
            <strong className="text-white light:text-slate-900">Delete your account:</strong>{" "}
            permanently delete your account and profile from Settings at any time. This can&apos;t
            be undone.
          </li>
        </ul>
      </Section>

      <Section title="6. Children's privacy">
        <p>
          InPlayer requires all accounts to be 13 or older, and if you&apos;re under 18 we ask
          you to confirm you have your parent or guardian&apos;s permission at signup. India&apos;s
          Digital Personal Data Protection Act, 2023 defines a &quot;child&quot; as anyone under
          18 and calls for verifiable parental consent before processing a child&apos;s data — our
          current under-18 signup flow is a self-declared confirmation, not yet a verified
          parental-consent flow. We&apos;re working towards full compliance as that law&apos;s
          rules come into effect. We don&apos;t knowingly collect data from anyone under 13, don&apos;t
          show targeted ads to any account that&apos;s declared itself under 18, and don&apos;t
          build ad-targeting profiles of minors. If you believe a child under 13 has created an
          account, or that a minor&apos;s account needs attention, contact{" "}
          <a href="mailto:contact@inplayer.in" className="text-orange-400 hover:underline">
            contact@inplayer.in
          </a>{" "}
          and we&apos;ll act on it.
        </p>
      </Section>

      <Section title="7. Your rights &amp; grievance officer">
        <p>
          Under India&apos;s Digital Personal Data Protection Act, 2023, you can ask us to: tell
          you what personal data we hold about you, correct it if it&apos;s wrong or incomplete,
          or erase it (subject to what we&apos;re legally required to keep, like security logs).
          Email{" "}
          <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">
            support@inplayer.in
          </a>{" "}
          to make any of these requests — we aim to respond within 30 days and, at most, 90 days.
        </p>
        <p>
          For complaints about how we handle your data, contact our Grievance Officer — the same
          contact listed in our{" "}
          <Link href="/terms" className="text-orange-400 hover:underline">
            Terms of Service
          </Link>
          . If a data breach affects your account, we&apos;ll notify you without undue delay.
        </p>
        <p>
          We keep your data only as long as your account is active or as needed for the purposes
          above; when you delete your account, we delete your personal data except where the law
          requires us to retain certain records (such as security/audit logs) for a limited time.
        </p>
      </Section>

      <Section title="8. Changes to this policy">
        <p>
          If we make a material change to how we handle your data, we&apos;ll update the
          &quot;Last updated&quot; date above.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Questions about your data? Email{" "}
          <a href="mailto:contact@inplayer.in" className="text-orange-400 hover:underline">
            contact@inplayer.in
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
