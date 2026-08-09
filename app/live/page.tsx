"use client";

import { useState, useRef, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Radio, Loader2, StopCircle } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

interface LiveCreds {
  streamKey: string;
  ingestEndpoint: string;
  playbackUrl: string;
}

export default function LivePage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [creds, setCreds] = useState<LiveCreds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  
  // Store the client and stream instance so we can stop it later
  const broadcastClientRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopBroadcast();
    };
  }, []);

  const stopBroadcast = () => {
    if (broadcastClientRef.current) {
      try {
        broadcastClientRef.current.stopBroadcast();
      } catch (e) {
        console.error(e);
      }
      broadcastClientRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsBroadcasting(false);
    setCreds(null);
  };

  const startLive = async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      // 1. Get AWS IVS Channel Details
      const res = await fetch("/api/live/ivs-create", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't start a live stream.");
        setLoading(false);
        return;
      }

      setCreds(data);

      // 2. Initialize Web Broadcast SDK dynamically to avoid SSR issues
      const IVSBroadcastClientModule = (await import("amazon-ivs-web-broadcast")).default;
      
      const client = IVSBroadcastClientModule.create({
        streamConfig: IVSBroadcastClientModule.STANDARD_LANDSCAPE,
        ingestEndpoint: data.ingestEndpoint,
      });

      broadcastClientRef.current = client;

      // 3. Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;

      // 4. Attach preview
      if (previewRef.current) {
        client.attachPreview(previewRef.current);
      }

      // 5. Add devices to the client
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        await client.addVideoInputDevice(videoTrack, "camera1", { index: 0 });
      }
      if (audioTrack) {
        await client.addAudioInputDevice(audioTrack, "mic1");
      }

      // 6. Start Broadcast!
      await client.startBroadcast(data.streamKey);
      
      setIsBroadcasting(true);
    } catch (err) {
      console.error("Failed to start live stream:", err);
      setError("Something went wrong. Please check your camera permissions and try again.");
      stopBroadcast();
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Sign in to go live
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
          You need an InPlayer account to start a live stream.
        </p>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/20">
          <Radio size={22} className={isBroadcasting ? "animate-pulse" : ""} />
        </span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            {isBroadcasting ? "You are LIVE!" : "Live Studio"}
          </h1>
          <p className="text-sm text-slate-400 light:text-slate-600">
            {isBroadcasting 
              ? "Your camera and microphone are being broadcasted directly from the browser."
              : "1-Click broadcast directly from your browser. No OBS required!"}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-[28px] overflow-hidden border border-white/10 light:border-black/10 bg-black relative shadow-2xl">
        {/* Live Preview Canvas */}
        <div className="aspect-video w-full bg-[#0a0a0a] flex items-center justify-center relative">
          {!isBroadcasting && !loading && (
            <div className="absolute text-slate-500 flex flex-col items-center gap-2">
              <Radio size={32} className="opacity-50" />
              <span className="text-sm font-medium">Ready to broadcast</span>
            </div>
          )}
          {loading && (
            <div className="absolute text-orange-400 flex flex-col items-center gap-3 z-10 bg-black/50 p-6 rounded-3xl backdrop-blur-md">
              <Loader2 size={32} className="animate-spin" />
              <span className="text-sm font-bold tracking-wide uppercase">Connecting...</span>
            </div>
          )}
          <canvas 
            ref={previewRef} 
            className={`w-full h-full object-cover transition-opacity duration-500 ${isBroadcasting ? 'opacity-100' : 'opacity-0'}`} 
          />
          
          {isBroadcasting && (
            <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-500/30 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white"></div>
              LIVE
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 bg-white/[0.03] light:bg-black/[0.03] border-t border-white/10 light:border-black/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-400 light:text-slate-600">
            {isBroadcasting && creds ? (
              <div>
                <p><strong>Playback URL:</strong></p>
                <code className="text-xs break-all bg-black/30 p-2 rounded block mt-1 border border-white/10">
                  {creds.playbackUrl}
                </code>
              </div>
            ) : (
              "Click the button to request camera permissions and go live instantly."
            )}
          </div>
          
          {!isBroadcasting ? (
            <button
              onClick={startLive}
              disabled={loading}
              className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3.5 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Radio size={18} />
              Start Broadcast
            </button>
          ) : (
            <button
              onClick={stopBroadcast}
              className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 hover:bg-red-600 px-8 py-3.5 font-bold text-white shadow-[0_15px_35px_rgba(239,68,68,.3)] transition-all hover:-translate-y-0.5"
            >
              <StopCircle size={18} />
              Stop Broadcast
            </button>
          )}
        </div>
        
        {error && (
          <div className="p-4 bg-red-500/10 border-t border-red-500/20 text-red-400 text-sm font-medium text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
