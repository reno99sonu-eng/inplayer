import type { Metadata } from "next";
import { playables } from "@/app/data/playables";
import GamePlayerClient from "./GamePlayerClient";

interface PlayPageProps {
  params: Promise<{ gameId: string }>;
}

// generateMetadata only runs in a Server Component, and this page's actual
// interactive logic (localStorage recent-games history, the iframe player)
// needs "use client" — so the client logic moved verbatim into
// GamePlayerClient.tsx (see that file) and this file became the thin
// server wrapper that supplies real per-game metadata and renders it.
// `playables` is a small static, synchronously-imported array (not a
// database read), so this has zero extra cost or risk.
export async function generateMetadata({
  params,
}: PlayPageProps): Promise<Metadata> {
  const { gameId } = await params;
  const game = playables.find((p) => p.id === gameId);

  if (!game) {
    return { title: "Game not found" };
  }

  const title = `Play ${game.title}`;
  const description = `Play ${game.title} by ${game.developer} free on INPLAYER.`;

  return {
    title,
    description,
    alternates: { canonical: `/play/${gameId}` },
    openGraph: {
      title,
      description,
      images: [game.thumbnail],
    },
  };
}

export default function PlayPage() {
  return <GamePlayerClient />;
}
