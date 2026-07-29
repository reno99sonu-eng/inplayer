import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Real, InPlayer-specific Privacy Policy — see the note in app/terms/page.tsx:
// this reflects how InPlayer actually collects and uses data today, but is
// a working draft, not a substitute for legal review before this goes live
// to real users (especially given InPlayer allows signups from age 13+).
export const metadata = {
  title: "Privacy Policy — InPlayer",
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
        </ul>
        <p>
          We don&apos;t currently process real payments on InPlayer — no payment provider
          receives your data today. If that changes, we&apos;ll update this policy first.
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
          InPlayer requires all accounts to be 13 or older. We don&apos;t knowingly collect data
          from anyone under 13. If you believe a child under 13 has created an account, contact
          us at{" "}
          <a href="mailto:contact@inplayer.in" className="text-orange-400 hover:underline">
            contact@inplayer.in
          </a>{" "}
          and we&apos;ll remove it.
        </p>
      </Section>

      <Section title="7. Changes to this policy">
        <p>
          If we make a material change to how we handle your data, we&apos;ll update the
          &quot;Last updated&quot; date above.
        </p>
      </Section>

      <Section title="8. Contact">
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
