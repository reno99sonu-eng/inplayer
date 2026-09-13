"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  ShieldAlert,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
  ExternalLink,
} from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";

export type CopyrightTab = "policy" | "notice" | "appeal";

function CopyrightHubInner({
  policyContent,
}: {
  policyContent: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as CopyrightTab) || "policy";
  const prefillVideoId = searchParams.get("videoId") || "";

  const [tab, setTab] = useState<CopyrightTab>(
    initialTab === "notice" || initialTab === "appeal" ? initialTab : "policy"
  );

  // Sync tab with URL search parameter if it changes
  useEffect(() => {
    const qTab = searchParams.get("tab");
    if (qTab === "notice" || qTab === "appeal" || qTab === "policy") {
      setTab(qTab);
    }
  }, [searchParams]);

  // Notice form state
  const [noticeForm, setNoticeForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    workTitle: "",
    workType: "Video / Film",
    ownershipBasis: "I am the copyright owner",
    infringingUrl: prefillVideoId ? `https://inplayer.in/watch/${prefillVideoId}` : "",
    infringingDescription: "",
    goodFaithConfirmed: false,
    accuracyConfirmed: false,
    signature: "",
  });
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const [noticeSuccess, setNoticeSuccess] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  // Appeal form state
  const [appealForm, setAppealForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    videoId: prefillVideoId,
    videoTitle: "",
    appealBasis: "Mistake or misidentification of the material",
    explanation: "",
    evidenceUrls: "",
    goodFaithConfirmed: false,
    signature: "",
  });
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState<string | null>(null);
  const [appealError, setAppealError] = useState<string | null>(null);

  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeError(null);
    setNoticeSuccess(null);
    setNoticeSubmitting(true);

    try {
      let idToken: string | undefined;
      try {
        const session = await fetchAuthSession();
        idToken = session.tokens?.idToken?.toString();
      } catch {
        // External notices can be submitted without login
      }

      const res = await fetch("/api/copyright/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken && { Authorization: `Bearer ${idToken}` }),
        },
        body: JSON.stringify(noticeForm),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit notice.");
      }

      setNoticeSuccess(
        `Your copyright notice was received (Ref: ${data.reportId}). Our grievance officer and trust & safety team will review it.`
      );
      setNoticeForm({
        fullName: "",
        email: "",
        phone: "",
        workTitle: "",
        workType: "Video / Film",
        ownershipBasis: "I am the copyright owner",
        infringingUrl: "",
        infringingDescription: "",
        goodFaithConfirmed: false,
        accuracyConfirmed: false,
        signature: "",
      });
    } catch (err) {
      setNoticeError(err instanceof Error ? err.message : "Submission error");
    } finally {
      setNoticeSubmitting(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppealError(null);
    setAppealSuccess(null);
    setAppealSubmitting(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) {
        throw new Error("You must be signed in to your creator account to submit a counter-notice or appeal.");
      }

      const res = await fetch("/api/copyright/appeal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(appealForm),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit appeal.");
      }

      setAppealSuccess(
        `Your counter-notice / appeal was submitted (Ref: ${data.reportId}). Our team will review your justification.`
      );
      setAppealForm({
        fullName: "",
        email: "",
        phone: "",
        videoId: "",
        videoTitle: "",
        appealBasis: "Mistake or misidentification of the material",
        explanation: "",
        evidenceUrls: "",
        goodFaithConfirmed: false,
        signature: "",
      });
    } catch (err) {
      setAppealError(err instanceof Error ? err.message : "Submission error");
    } finally {
      setAppealSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hub Navigation Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4 light:border-slate-200">
        <button
          type="button"
          onClick={() => setTab("policy")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "policy"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
              : "bg-white/5 text-slate-300 light:text-slate-700 hover:bg-white/10 light:bg-slate-100"
          }`}
        >
          <FileText size={14} /> Copyright &amp; IP Policy
        </button>

        <button
          type="button"
          onClick={() => setTab("notice")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "notice"
              ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
              : "bg-white/5 text-slate-300 light:text-slate-700 hover:bg-white/10 light:bg-slate-100"
          }`}
        >
          <ShieldAlert size={14} /> Report Copyright (Submit Notice)
        </button>

        <button
          type="button"
          onClick={() => setTab("appeal")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "appeal"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/25"
              : "bg-white/5 text-slate-300 light:text-slate-700 hover:bg-white/10 light:bg-slate-100"
          }`}
        >
          <Scale size={14} /> Counter-Notice &amp; Appeal
        </button>
      </div>

      {/* Tab 1: Official Policy Text */}
      {tab === "policy" && policyContent}

      {/* Tab 2: Formal Copyright Complaint Notice */}
      {tab === "notice" && (
        <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
          <div className="border-b border-white/10 pb-5 light:border-slate-200">
            <span className="inline-block rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-400">
              Statutory Notice Form
            </span>
            <h2 className="mt-2 text-2xl font-black text-white light:text-slate-900">
              Submit Copyright Infringement Notice
            </h2>
            <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
              In accordance with Section 10 of InPlayer&apos;s Copyright Policy and the Indian Copyright Act, 1957.
              Only the copyright owner or their authorized legal agent should submit this notice.
            </p>
          </div>

          {noticeSuccess ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
              <h3 className="mt-2 text-base font-bold text-white light:text-slate-900">Notice Submitted</h3>
              <p className="mt-1 text-sm text-slate-300 light:text-slate-700">{noticeSuccess}</p>
              <button
                onClick={() => setNoticeSuccess(null)}
                className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                Submit another notice
              </button>
            </div>
          ) : (
            <form onSubmit={handleNoticeSubmit} className="mt-6 space-y-4">
              {noticeError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  <span>{noticeError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={noticeForm.fullName}
                    onChange={(e) => setNoticeForm({ ...noticeForm, fullName: e.target.value })}
                    placeholder="Your legal full name"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-red-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={noticeForm.email}
                    onChange={(e) => setNoticeForm({ ...noticeForm, email: e.target.value })}
                    placeholder="rights-holder@example.com"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-red-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={noticeForm.phone}
                    onChange={(e) => setNoticeForm({ ...noticeForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-red-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                    Ownership / Authority Basis *
                  </label>
                  <select
                    value={noticeForm.ownershipBasis}
                    onChange={(e) => setNoticeForm({ ...noticeForm, ownershipBasis: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#0A1424] px-3 py-2 text-sm text-white light:border-slate-300 light:bg-white light:text-slate-900 outline-none focus:border-red-400"
                  >
                    <option value="I am the copyright owner">I am the copyright owner</option>
                    <option value="I am an authorized agent / representative">
                      I am an authorized agent / representative
                    </option>
                    <option value="I hold an exclusive license">I hold an exclusive license</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Identification of the Copyrighted Work *
                </label>
                <input
                  type="text"
                  required
                  value={noticeForm.workTitle}
                  onChange={(e) => setNoticeForm({ ...noticeForm, workTitle: e.target.value })}
                  placeholder="e.g. Original Song title, Film name, Photography title, Book title"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-red-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Allegedly Infringing InPlayer URL or Video ID *
                </label>
                <input
                  type="text"
                  required
                  value={noticeForm.infringingUrl}
                  onChange={(e) => setNoticeForm({ ...noticeForm, infringingUrl: e.target.value })}
                  placeholder="https://inplayer.in/watch/VIDEO_ID or VIDEO_ID"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-red-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Explanation of Infringement *
                </label>
                <textarea
                  required
                  rows={3}
                  value={noticeForm.infringingDescription}
                  onChange={(e) => setNoticeForm({ ...noticeForm, infringingDescription: e.target.value })}
                  placeholder="Describe where in the video the copyrighted work appears (e.g. timestamp 01:23-02:45, entire video, audio track sync) and why it is unauthorized."
                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-red-400"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={noticeForm.goodFaithConfirmed}
                    onChange={(e) => setNoticeForm({ ...noticeForm, goodFaithConfirmed: e.target.checked })}
                    className="mt-0.5 rounded border-white/20 text-red-500 focus:ring-0"
                  />
                  <span>
                    <strong>Good Faith Statement:</strong> I have a good-faith belief that use of the material in
                    the manner complained of is not authorized by the copyright owner, its agent, or applicable law.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={noticeForm.accuracyConfirmed}
                    onChange={(e) => setNoticeForm({ ...noticeForm, accuracyConfirmed: e.target.checked })}
                    className="mt-0.5 rounded border-white/20 text-red-500 focus:ring-0"
                  />
                  <span>
                    <strong>Accuracy Declaration:</strong> The information in this notification is accurate, and under
                    penalty of applicable law, I am the owner, or an agent authorized to act on behalf of the owner, of
                    an exclusive right that is allegedly infringed.
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Electronic Signature (Type your Full Legal Name) *
                </label>
                <input
                  type="text"
                  required
                  value={noticeForm.signature}
                  onChange={(e) => setNoticeForm({ ...noticeForm, signature: e.target.value })}
                  placeholder="Your Full Legal Name"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-red-400 font-serif italic"
                />
              </div>

              <button
                type="submit"
                disabled={noticeSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
              >
                {noticeSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Submit Copyright Complaint
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tab 3: Creator Counter-Notice & Appeal */}
      {tab === "appeal" && (
        <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
          <div className="border-b border-white/10 pb-5 light:border-slate-200">
            <span className="inline-block rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-400">
              Sections 19 &amp; 20 Counter-Notice
            </span>
            <h2 className="mt-2 text-2xl font-black text-white light:text-slate-900">
              Submit Copyright Counter-Notice / Appeal
            </h2>
            <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
              If your video was removed or received a copyright strike and you believe it was due to a mistake,
              misidentification, or that you hold a valid legal right/license, submit this formal counter-notice.
            </p>
          </div>

          {appealSuccess ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
              <h3 className="mt-2 text-base font-bold text-white light:text-slate-900">Counter-Notice Submitted</h3>
              <p className="mt-1 text-sm text-slate-300 light:text-slate-700">{appealSuccess}</p>
              <button
                onClick={() => setAppealSuccess(null)}
                className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                Submit another appeal
              </button>
            </div>
          ) : (
            <form onSubmit={handleAppealSubmit} className="mt-6 space-y-4">
              {appealError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  <span>{appealError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={appealForm.fullName}
                    onChange={(e) => setAppealForm({ ...appealForm, fullName: e.target.value })}
                    placeholder="Your legal name"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={appealForm.email}
                    onChange={(e) => setAppealForm({ ...appealForm, email: e.target.value })}
                    placeholder="your-email@example.com"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                    Video ID or URL Under Appeal *
                  </label>
                  <input
                    type="text"
                    required
                    value={appealForm.videoId}
                    onChange={(e) => setAppealForm({ ...appealForm, videoId: e.target.value })}
                    placeholder="e.g. VIDEO_ID or /watch/VIDEO_ID"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                    Video Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={appealForm.videoTitle}
                    onChange={(e) => setAppealForm({ ...appealForm, videoTitle: e.target.value })}
                    placeholder="Title of the restricted video"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Legal Basis for Counter-Notice *
                </label>
                <select
                  value={appealForm.appealBasis}
                  onChange={(e) => setAppealForm({ ...appealForm, appealBasis: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#0A1424] px-3 py-2 text-sm text-white light:border-slate-300 light:bg-white light:text-slate-900 outline-none focus:border-cyan-400"
                >
                  <option value="Mistake or misidentification of the material">
                    Mistake or misidentification of the material
                  </option>
                  <option value="I own all rights or hold a valid express license">
                    I own all rights or hold a valid express license
                  </option>
                  <option value="Content is in the public domain or Creative Commons">
                    Content is in the public domain or Creative Commons
                  </option>
                  <option value="Fair dealing statutory exception under Section 52 of the Indian Copyright Act, 1957">
                    Fair dealing statutory exception under Section 52 of the Copyright Act, 1957 (criticism, review, reporting, education)
                  </option>
                  <option value="Other lawful statutory basis">Other lawful statutory basis</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Detailed Statement of Facts / Explanation *
                </label>
                <textarea
                  required
                  rows={4}
                  value={appealForm.explanation}
                  onChange={(e) => setAppealForm({ ...appealForm, explanation: e.target.value })}
                  placeholder="Explain in detail why the removal or strike was an error, why you have lawful authority, or how the content qualifies under Section 52 of the Copyright Act, 1957."
                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Evidence / Documentation Links (Optional)
                </label>
                <input
                  type="text"
                  value={appealForm.evidenceUrls}
                  onChange={(e) => setAppealForm({ ...appealForm, evidenceUrls: e.target.value })}
                  placeholder="Link to written license, public domain source, proof of creation"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-cyan-400"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={appealForm.goodFaithConfirmed}
                    onChange={(e) => setAppealForm({ ...appealForm, goodFaithConfirmed: e.target.checked })}
                    className="mt-0.5 rounded border-white/20 text-cyan-500 focus:ring-0"
                  />
                  <span>
                    <strong>Good Faith &amp; Accuracy Confirmation:</strong> I state under penalty of perjury and
                    applicable Indian law that I have a good-faith belief that the material was removed or disabled as a
                    result of mistake or misidentification, or that I have the necessary rights or legal exceptions to
                    publish the material.
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Electronic Signature (Type your Full Legal Name) *
                </label>
                <input
                  type="text"
                  required
                  value={appealForm.signature}
                  onChange={(e) => setAppealForm({ ...appealForm, signature: e.target.value })}
                  placeholder="Your Full Legal Name"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 outline-none focus:border-cyan-400 font-serif italic"
                />
              </div>

              <button
                type="submit"
                disabled={appealSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
              >
                {appealSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Submit Counter-Notice / Appeal
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function CopyrightHubClient({
  policyContent,
}: {
  policyContent: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center py-12 text-center text-slate-500">
          <Loader2 size={24} className="animate-spin text-orange-400" />
        </div>
      }
    >
      <CopyrightHubInner policyContent={policyContent} />
    </Suspense>
  );
}

