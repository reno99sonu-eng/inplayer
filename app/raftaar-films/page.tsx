import type { Metadata } from "next";
import RaftaarFilmsLanding from "@/app/components/raftaar-films/RaftaarFilmsLanding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Raftaar Films — Watch Micro-Drama Series | INPLAYER",
  description:
    "Discover binge-worthy episodic micro-drama series, thrillers, romances, and comedies from top creators on InPlayer Raftaar Films.",
  alternates: {
    canonical: "https://inplayer.in/raftaar-films",
  },
};

export default function RaftaarFilmsPage() {
  return <RaftaarFilmsLanding />;
}
