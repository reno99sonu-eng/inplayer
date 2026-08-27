"use client";

import { useRouter } from "next/navigation";
import { Info, HelpCircle, Mail, ShieldCheck, Sparkles, FileText, Lock } from "lucide-react";
import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import ReportProblemCard from "./ReportProblemCard";

export default function AboutSection() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={<Info size={24} />}
        title="About InPlayer"
        description="The Future of Entertainment."
      >
        <p className="text-sm leading-6 text-slate-400 light:text-slate-600">
          InPlayer is a creator-first entertainment platform for streaming
          videos and Shorts, built to feel as fast and premium as the biggest
          platforms — with creators at the center.
        </p>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] px-5 py-4">
          <Sparkles size={18} className="text-orange-300" />
          <div>
            <p className="text-sm font-bold text-white light:text-slate-900">InPlayer</p>
            <p className="text-xs text-slate-500 light:text-slate-600">Version 0.1.0 · Beta</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<ShieldCheck size={24} />}
        title="Legal & Support"
        description="Get help or learn how your data is handled."
      >
        <div className="space-y-2">
          <SettingsRow
            icon={<HelpCircle size={20} />}
            title="Help Center"
            description="Guides, FAQs and troubleshooting."
            onClick={() => router.push("/help")}
          />

          <SettingsRow
            icon={<Mail size={20} />}
            title="Contact Support"
            description="support@inplayer.in"
            onClick={() => {
              window.location.href = "mailto:support@inplayer.in";
            }}
          />

          <SettingsRow
            icon={<FileText size={20} />}
            title="Terms of Service"
            description="Includes our IT Rules Grievance Officer contact."
            onClick={() => router.push("/terms")}
          />

          <SettingsRow
            icon={<FileText size={20} />}
            title="HamMart Vendor Terms"
            description="Terms & Conditions for HamMart sellers and vendors."
            onClick={() => router.push("/hammart-vendor-terms")}
          />

          <SettingsRow
            icon={<Lock size={20} />}
            title="Privacy Policy"
            description="What data we collect and your rights over it."
            onClick={() => router.push("/privacy")}
          />

          <ReportProblemCard />
        </div>
      </SettingsCard>
    </div>
  );
}
