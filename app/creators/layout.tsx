import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creators — Discover Top Indian Content Creators",
  description: "Explore and subscribe to talented Indian video and music creators, channels, and community leaders on InPlayer.",
  alternates: {
    canonical: "https://inplayer.in/creators",
  },
};

export default function CreatorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
