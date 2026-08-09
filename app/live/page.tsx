"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Radio,
  Loader2,
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Square,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

interface LiveCreds {
  streamKey: string;
  playbackId: string | null;
  rtmpUrl: string;
  isTest?: boolean;
}

// In-browser WebRTC (WHIP) streamer to Mux — communicates with the backend
// to stream live directly from the user's camera with 1 click. No external
// software or technical configuration required.
async function startWhipStream(stream: MediaStream, streamKey: string): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const whipUrl = `https://live-whip.mux.com/app/${streamKey}`;
  const res = await fetch(whipUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
    },
    body: offer.sdp,
  });

  if (!res.ok) {
    throw new Error(`WHIP stream negotiation failed with status ${res.status}`);
  }

  const answerSdp = await res.text();
  await pc.setRemoteDescription({
    type: "answer",
    sdp: answerSdp,
  });

  return pc;
}

export default function LivePage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();

  const [creds, setCreds] = useState<LiveCreds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-browser Camera & Live Broadcast State
  const [cameraActive, setCameraActive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastTime, setBroadcastTime] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Auto-start camera when user arrives on Go Live page
  useEffect(() => {
    if (signedIn) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [signedIn]);

  // Live broadcast timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isBroadcasting) {
      timer = setInterval(() => {
        setBroadcastTime((prev) => prev + 1);
      }, 1000);
    } else {
      setBroadcastTime(0);
    }
    return () => clearInterval(timer);
  }, [isBroadcasting]);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      mediaStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setMicEnabled(true);
      setVideoEnabled(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      setError("Please allow camera and microphone access to stream live from your browser.");
    }
  };

  const stopCamera = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsBroadcasting(false);
  };

  const toggleMic = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (mediaStreamRef.current) {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const startAutomaticBroadcast = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!mediaStreamRef.current) {
        await startCamera();
      }

      if (!mediaStreamRef.current) {
        throw new Error("Camera or microphone is unavailable.");
      }

      // Automatically request live stream session from backend
      let activeCreds = creds;
      if (!activeCreds) {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        const res = await fetch("/api/live/create", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Couldn't initialize live stream.");
        }
        activeCreds = data;
        setCreds(activeCreds);
      }

      if (!activeCreds?.streamKey) {
        throw new Error("Couldn't obtain live stream key.");
      }

      // Automatically establish WHIP WebRTC connection directly to streaming server
      const pc = await startWhipStream(mediaStreamRef.current, activeCreds.streamKey);
      peerConnectionRef.current = pc;
      setIsBroadcasting(true);
    } catch (err) {
      console.error("Failed to start live stream:", err);
      setError(err instanceof Error ? err.message : "Couldn't start live stream. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const stopBroadcast = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsBroadcasting(false);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
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
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:py-12">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg">
          <Radio size={22} />
        </span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            Go Live Studio
          </h1>
          <p className="text-sm text-slate-400 light:text-slate-600">
            Stream live directly from your camera with 1 click.
          </p>
        </div>
      </div>

      {/* Main Automatic Live Studio View */}
      <div className="mt-8 space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 light:border-black/10 bg-black aspect-video flex items-center justify-center shadow-2xl">
          {/* Live Camera Feed */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover transition-opacity duration-500 ${
              cameraActive && videoEnabled ? "opacity-100" : "opacity-0 absolute"
            }`}
          />

          {!cameraActive && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 text-orange-400">
                <Camera size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white light:text-slate-900">
                  Camera Preview
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-400 light:text-slate-600">
                  Allow camera permissions to preview your video before going live.
                </p>
              </div>
              <button
                type="button"
                onClick={startCamera}
                className="rounded-2xl bg-white/10 px-6 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition light:bg-black/10 light:text-slate-900"
              >
                Turn On Camera
              </button>
            </div>
          )}

          {cameraActive && !videoEnabled && (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
              <VideoOff size={36} />
              <p className="text-xs">Camera Turned Off</p>
            </div>
          )}

          {/* Floating Status Badges */}
          {cameraActive && (
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              {isBroadcasting ? (
                <div className="flex items-center gap-2 rounded-full bg-red-600 px-3.5 py-1 text-xs font-black uppercase text-white shadow-lg animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  LIVE • {formatTime(broadcastTime)}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Ready to Stream
                </div>
              )}
            </div>
          )}

          {/* Controls Bar */}
          {cameraActive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/70 backdrop-blur-md px-4 py-2 border border-white/15">
              <button
                type="button"
                onClick={toggleMic}
                className={`p-2.5 rounded-full transition ${
                  micEnabled ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400"
                }`}
                title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
              >
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              <button
                type="button"
                onClick={toggleVideo}
                className={`p-2.5 rounded-full transition ${
                  videoEnabled ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400"
                }`}
                title={videoEnabled ? "Turn Off Camera" : "Turn On Camera"}
              >
                {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
            </div>
          )}
        </div>

        {/* Start / Stop Broadcast Button */}
        <div className="flex flex-col items-center justify-center gap-4">
          {!isBroadcasting ? (
            <button
              type="button"
              onClick={startAutomaticBroadcast}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-10 py-4 font-black text-white text-base sm:text-lg shadow-[0_15px_35px_rgba(255,153,0,.35)] transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  Connecting Stream…
                </>
              ) : (
                <>
                  <Sparkles size={22} />
                  🔴 GO LIVE NOW
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopBroadcast}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 hover:bg-red-700 px-8 py-3.5 font-bold text-white shadow-lg transition-all active:scale-95"
            >
              <Square size={18} />
              End Live Broadcast
            </button>
          )}

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700 text-center max-w-md">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
