"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface IVSPlayerProps {
  streamUrl: string;
  children?: React.ReactNode;
}

export default function IVSPlayer({ streamUrl, children }: IVSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerLoaded, setPlayerLoaded] = useState(false);

  useEffect(() => {
    if (!playerLoaded) return;
    if (!videoRef.current) return;

    // Load the IVS Player script first, but typically we can just import it dynamically or assume the script loaded.
    // In React/Next.js, importing 'amazon-ivs-player' works best if we use dynamic import
    let player: any;

    const initPlayer = async () => {
      try {
        const IVSPlayer = (await import("amazon-ivs-player")).default;

        if (!IVSPlayer.isPlayerSupported) {
          console.error("IVS Player is not supported in this browser");
          return;
        }

        player = IVSPlayer.create();
        player.attachHTMLVideoElement(videoRef.current);
        player.load(streamUrl);
        player.play();
      } catch (err) {
        console.error("Error initializing IVS Player:", err);
      }
    };

    initPlayer();

    return () => {
      if (player) {
        player.delete();
      }
    };
  }, [streamUrl, playerLoaded]);

  // A trick to trigger effect when IVS player could be ready if we needed external script, 
  // but since we have it via npm we can just set it immediately true on mount.
  useEffect(() => {
    setPlayerLoaded(true);
  }, []);

  return (
    <div className="relative w-full aspect-video bg-black rounded-[28px] overflow-hidden border border-white/10 shadow-2xl">
      <video
        ref={videoRef}
        id="video-player"
        playsInline
        autoPlay
        controls
        className="w-full h-full object-cover"
      ></video>
      {children}
    </div>
  );
}
