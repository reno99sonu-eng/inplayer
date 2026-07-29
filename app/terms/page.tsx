import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Real, InPlayer-specific Terms of Service — this is what the signup flow
// and TermsAcceptanceModal (app/components/auth/TermsAcceptanceModal.tsx)
// actually link to now, replacing a blind Accept/Reject with nothing to
// read. IMPORTANT: this is a working draft written to match how InPlayer
// actually functions today (13+ age gate, real AI moderation, real report
// system, etc.) — it is not a substitute for review by a lawyer familiar
// with Indian IT Rules / consumer protection law before this goes live to
// real users.
export const metadata = {
  title: "Terms of Service — InPlayer",
};

const LAST_UPDATED = "29 July 2026";

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

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 light:text-slate-600 hover:text-orange-400"
      >
        <ArrowLeft size={16} /> Back to InPlayer
      </Link>

      <h1 className="mt-6 text-3xl font-black text-white light:text-slate-900">
        Terms of Service
      </h1>
      <p className="mt-1 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6 text-sm leading-6 text-slate-300 light:text-slate-700">
        These Terms govern your use of InPlayer (inplayer.in), including our website, mobile
        experience, video and Shorts hosting, comments, and direct messaging. By creating an
        account or using InPlayer, you agree to these Terms.
      </p>

      <Section title="1. Who can use InPlayer">
        <p>
          You must be at least 13 years old to create an InPlayer account. If you are under 18,
          you confirm you have your parent or guardian&apos;s permission to use InPlayer. We ask
          for your age at signup to enforce this.
        </p>
      </Section>

      <Section title="2. Your account">
        <p>
          You&apos;re responsible for keeping your password secure and for everything that
          happens under your account. Tell us right away at{" "}
          <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">
            support@inplayer.in
          </a>{" "}
          if you believe your account has been compromised.
        </p>
        <p>
          You can permanently delete your account at any time from Settings. This removes your
          profile and cannot be undone — see our{" "}
          <Link href="/privacy" className="text-orange-400 hover:underline">
            Privacy Policy
          </Link>{" "}
          for exactly what happens to your data when you do.
        </p>
      </Section>

      <Section title="3. Content you post">
        <p>
          You keep ownership of the videos, Shorts, comments, and messages you post. By posting
          on InPlayer, you give us a license to host, store, display, and distribute that content
          on InPlayer so other users can view it — nothing more. You&apos;re responsible for
          having the rights to anything you upload.
        </p>
        <p>You agree not to post content that:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Infringes someone else&apos;s copyright or other rights</li>
          <li>Contains hate speech, harassment, or threats of violence</li>
          <li>Sexually exploits or endangers a minor, in any form</li>
          <li>Is spam, scam, or deliberately misleading</li>
          <li>Violates any applicable law</li>
        </ul>
        <p>
          To help enforce this, InPlayer automatically scans new comments, direct messages, and
          upload titles/descriptions for likely policy violations at the moment they&apos;re
          posted, and holds back anything flagged until a human reviews it. Any user can also
          report content directly (the Report option under videos, comments, and messages) — see
          our{" "}
          <Link href="/privacy" className="text-orange-400 hover:underline">
            Privacy Policy
          </Link>{" "}
          for how that moderation works.
        </p>
      </Section>

      <Section title="4. Copyright (DMCA-style takedowns)">
        <p>
          If you believe your copyrighted work has been uploaded to InPlayer without
          permission, report it using the Report option on the video (choose &quot;Copyright
          infringement&quot;) or email{" "}
          <a href="mailto:contact@inplayer.in" className="text-orange-400 hover:underline">
            contact@inplayer.in
          </a>{" "}
          with a description of the work, the URL of the infringing content, and your contact
          details. We review copyright reports and remove infringing content when a claim is
          valid.
        </p>
      </Section>

      <Section title="5. Suspension and removal">
        <p>
          We may remove content or suspend an account that violates these Terms, including
          content our automated moderation flags as a serious violation (which is hidden
          immediately, before any human reviews it) and content removed after a user report. You
          can contact{" "}
          <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">
            support@inplayer.in
          </a>{" "}
          if you believe action was taken on your account in error.
        </p>
      </Section>

      <Section title="6. Disclaimers">
        <p>
          InPlayer is provided &quot;as is.&quot; We work to keep the service reliable and
          content appropriately moderated, but we don&apos;t guarantee the service will be
          uninterrupted, error-free, or that every piece of content will be caught by moderation
          before you see it.
        </p>
      </Section>

      <Section title="7. Changes to these Terms">
        <p>
          We may update these Terms as InPlayer changes. If we make a material change, we&apos;ll
          update the &quot;Last updated&quot; date above. Continuing to use InPlayer after a
          change means you accept the updated Terms.
        </p>
      </Section>

      <Section title="8. Contact">
        <p>
          Questions about these Terms? Email{" "}
          <a href="mailto:contact@inplayer.in" className="text-orange-400 hover:underline">
            contact@inplayer.in
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
