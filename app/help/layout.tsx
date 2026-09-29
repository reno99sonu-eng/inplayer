import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Support — InPlayer Help Center",
  description: "Find answers to frequently asked questions, playback troubleshooting, and contact InPlayer customer support.",
  alternates: {
    canonical: "https://inplayer.in/help",
  },
};

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
