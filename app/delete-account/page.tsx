import Link from "next/link";
import LegalBackButton from "../components/LegalBackButton";
import LegalNav from "../components/LegalNav";
import DeleteAccountClientSection from "./DeleteAccountClientSection";
import { Trash2, AlertTriangle, ShieldCheck, Clock, FileText, Lock } from "lucide-react";

export const metadata = {
  title: "Delete Account & Data Retention — InPlayer",
  description:
    "Information and instructions on how to request deletion of your InPlayer account and personal data, data retention principles, and statutory exceptions under DPDPA 2023.",
};

const EFFECTIVE_DATE = "September 5, 2026";
const POLICY_VERSION = "2026-09-05";

export default function DeleteAccountPage() {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:py-14">
      <LegalBackButton />
      <div className="mt-4">
        <LegalNav />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-white/10 pb-6 light:border-slate-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-400">
              <Trash2 size={13} /> Data Erasure &amp; Retention Policy
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-slate-400 light:bg-black/5 light:text-slate-600">
              v{POLICY_VERSION}
            </span>
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            ACCOUNT DELETION &amp; DATA RETENTION
          </h1>
          <p className="mt-1 text-sm font-semibold text-orange-300 light:text-orange-600">
            INPLAYER • OPERATED BY HOMOX PRIME PRIVATE LIMITED
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 light:text-slate-600">
            <p><strong>Effective Date:</strong> {EFFECTIVE_DATE}</p>
            <p><strong>Last Updated:</strong> {EFFECTIVE_DATE}</p>
            <p><strong>Jurisdiction:</strong> India (DPDPA 2023 &amp; IT Rules 2021)</p>
          </div>
        </div>

        {/* Intro */}
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          <p>
            At InPlayer, we respect your right to control your personal information. In compliance with the
            <strong> Digital Personal Data Protection Act, 2023 (DPDPA)</strong>, the <strong>Information Technology Rules, 2021</strong>,
            and Google Play Store Developer Policies, this page provides complete transparency regarding how you can request
            the deletion of your account and how data is handled upon deletion.
          </p>
        </div>

        {/* Section 1: What Data is Deleted */}
        <section className="mt-8 border-t border-white/5 pt-6 light:border-slate-200">
          <div className="flex items-center gap-2 text-base font-bold text-white light:text-slate-900">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h2>1. DATA DELETED UPON ACCOUNT DELETION</h2>
          </div>
          <p className="mt-2 text-sm text-slate-300 light:text-slate-700">
            When you request and confirm the deletion of your account, the following account data is permanently deleted from our active production database:
          </p>
          <ul className="mt-3 space-y-2 pl-5 text-sm text-slate-300 light:text-slate-700 list-disc">
            <li>
              <strong>Profile &amp; Account Credentials:</strong> Your display name, email address, password/authentication credentials, age, biography, avatar photo, and social media links.
            </li>
            <li>
              <strong>Username &amp; Handle Reservation:</strong> Your unique username handle is released from our system, freeing it for future registration.
            </li>
            <li>
              <strong>Uploaded Video Content:</strong> All videos, Shorts, audio tracks, and thumbnails uploaded by your account, including the underlying video master assets and associated video records.
            </li>
            <li>
              <strong>Authentication &amp; Active Sessions:</strong> Your account access is permanently revoked and active authentication sessions are terminated.
            </li>
          </ul>
        </section>

        {/* Section 2: What Data is Retained & Statutory Exceptions */}
        <section className="mt-8 border-t border-white/5 pt-6 light:border-slate-200">
          <div className="flex items-center gap-2 text-base font-bold text-white light:text-slate-900">
            <AlertTriangle size={18} className="text-amber-400" />
            <h2>2. DATA RETAINED &amp; STATUTORY EXCEPTIONS</h2>
          </div>
          <p className="mt-2 text-sm text-slate-300 light:text-slate-700">
            Pursuant to Sections 25 and 26 of our <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link>,
            deletion of an account may not immediately result in deletion of every record where retention is reasonably necessary or legally required:
          </p>
          <ul className="mt-3 space-y-2 pl-5 text-sm text-slate-300 light:text-slate-700 list-disc">
            <li>
              <strong>Communications &amp; Messages:</strong> Comments and messages sent to other users or customer support records may be retained where reasonably necessary to preserve communication history for other participants, resolve disputes, or comply with legal requirements (Sections 21, 25 &amp; 26).
            </li>
            <li>
              <strong>Financial &amp; Transaction Records:</strong> Transaction records, purchase orders, creator payout records, and invoices are retained for statutory accounting and regulatory periods as required by applicable Indian law (Section 25).
            </li>
            <li>
              <strong>Fraud Prevention, Security &amp; Safety Records:</strong> Information may be retained where reasonably necessary to detect or prevent fraud, address security or cybersecurity incidents, investigate abuse, or comply with applicable legal and regulatory obligations under Indian law (Sections 24, 25 &amp; 26).
            </li>
            <li>
              <strong>Outstanding Legal Obligations &amp; Disputes:</strong> Information subject to valid governmental requests, court orders, or active dispute resolution is retained for as long as necessary to satisfy such obligations (Sections 24 &amp; 26).
            </li>
          </ul>
        </section>

        {/* Section 3: Deletion Timeline & Technical Limitations */}
        <section className="mt-8 border-t border-white/5 pt-6 light:border-slate-200">
          <div className="flex items-center gap-2 text-base font-bold text-white light:text-slate-900">
            <Clock size={18} className="text-cyan-400" />
            <h2>3. DELETION TIMELINE &amp; TECHNICAL LIMITATIONS</h2>
          </div>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300 light:text-slate-700">
            <p>
              When an account deletion request is confirmed, access to your account is immediately terminated, your public channel profile and uploaded videos are taken offline, and your login credentials are deleted.
            </p>
            <p>
              Pursuant to Section 26 of our Privacy Policy, deletion of an account may not immediately result in the deletion of every record where retention is legally required or permitted. Residual copies or data stored in routine technical backups and system logs are subject to standard overwrite and archival lifecycle limitations.
            </p>
          </div>
        </section>

        {/* Section 4: Interactive Deletion Portal & Methods */}
        <section className="mt-8 border-t border-white/5 pt-6 light:border-slate-200">
          <div className="flex items-center gap-2 text-base font-bold text-white light:text-slate-900">
            <Lock size={18} className="text-orange-400" />
            <h2>4. HOW TO DELETE YOUR INPLAYER ACCOUNT</h2>
          </div>
          <p className="mt-2 text-sm text-slate-300 light:text-slate-700">
            Choose any of the three secure methods below to initiate account deletion:
          </p>

          <DeleteAccountClientSection />
        </section>

        {/* Section 5: Grievance Officer & Contact */}
        <section className="mt-8 border-t border-white/5 pt-6 light:border-slate-200">
          <div className="flex items-center gap-2 text-base font-bold text-white light:text-slate-900">
            <FileText size={18} className="text-orange-400" />
            <h2>5. GRIEVANCE OFFICER &amp; STATUTORY COMPLIANCE</h2>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700 space-y-1">
            <p><strong>Platform Operator:</strong> Homox Prime Private Limited</p>
            <p><strong>Registered Office:</strong> Vadodara, Gujarat, India</p>
            <p><strong>Grievance Officer:</strong> Mr. Ramchandra Kushwaha</p>
            <p><strong>Email Address:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p><strong>Response Timeline:</strong> Acknowledgment within 24 hours; disposal of grievance within 15 days as required by Rule 3(2) of the Information Technology Intermediary Rules, 2021.</p>
          </div>
        </section>

        {/* Footer Nav */}
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-slate-400 light:border-slate-200 light:text-slate-600">
          <p>
            Related Policies:{" "}
            <Link href="/terms" className="text-orange-400 hover:underline">Terms of Service</Link> •{" "}
            <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link> •{" "}
            <Link href="/child-safety" className="text-orange-400 hover:underline">Child Safety Policy</Link> •{" "}
            <Link href="/community-guidelines" className="text-orange-400 hover:underline">Community Guidelines</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
