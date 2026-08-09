"use client";

import { useState, useRef, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Radio, Loader2, StopCircle, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import VideoMetadataFields, { VideoMetadataValue, SpokenLanguage, Visibility } from "@/app/components/VideoMetadataFields";
import AITitleAssistModal from "@/app/components/AITitleAssistModal";
import { buildAIGeneratePrompt, parseAITitleSuggestions } from "@/app/lib/aiPrompts";
import { CONTENT_CATEGORIES } from "@/app/data/categories";

const CATEGORIES = CONTENT_CATEGORIES;

interface LiveCreds {
  videoId: string;
  streamKey: string;
  ingestEndpoint: string;
  playbackUrl: string;
  channelArn: string;
}

export default function LivePage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [creds, setCreds] = useState<LiveCreds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const previewRef = useRef<HTMLCanvasElement>(null);
  
  // Store the client and stream instance so we can stop it later
  const broadcastClientRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Pre-broadcast metadata state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [commentsEnabled, setCommentsEnabled] = useState(true);

  // AI Assistant state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiType, setAiType] = useState<"title" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTitleAssistOpen, setAiTitleAssistOpen] = useState(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopBroadcast();
    };
  }, []);

  const handleMetadataChange = <K extends keyof VideoMetadataValue>(
    field: K,
    val: VideoMetadataValue[K]
  ) => {
    switch (field) {
      case "title":
        setTitle(val as string);
        break;
      case "description":
        setDescription(val as string);
        break;
      case "visibility":
        setVisibility(val as Visibility);
        break;
      case "commentsEnabled":
        setCommentsEnabled(val as boolean);
        break;
    }
  };

  const handleGenerateAI = async (
    type: "title",
    userDescription?: string
  ) => {
    setAiGenerating(true);
    setAiError(null);
    setAiSuggestions([]);
    setAiType(type);

    try {
      const response = await fetch("/api/ai-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildAIGeneratePrompt(type, {
            title,
            description,
            category: "Live",
            contentType: "video",
            userDescription,
          }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI generation failed.");
      }

      if (type === "title") {
        const suggestions = parseAITitleSuggestions(data.text);
        setAiSuggestions(suggestions);
      }
    } catch (err) {
      console.error(err);
      setAiError(err instanceof Error ? err.message : "AI couldn't generate content.");
    } finally {
      setAiGenerating(false);
    }
  };

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
    
    if (isBroadcasting && creds) {
      // Mark as VOD ready
      fetch("/api/live/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: creds.videoId }),
      }).catch(console.error);
    }

    setIsBroadcasting(false);
    setCreds(null);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  const startLive = async () => {
    if (!title.trim()) {
      setError("Please give your live stream a title.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      // 1. Get AWS IVS Channel Details and create DynamoDB record
      const res = await fetch("/api/live/ivs-create", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          visibility,
          commentsEnabled
        })
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
        await client.addVideoInputDevice(new MediaStream([videoTrack]), "camera1", { index: 0 });
      }
      if (audioTrack) {
        await client.addAudioInputDevice(new MediaStream([audioTrack]), "mic1");
      }

      // Sync initial state
      setIsMicMuted(false);
      setIsVideoMuted(false);

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
            {isBroadcasting ? "You are LIVE!" : "Live Studio Setup"}
          </h1>
          <p className="text-sm text-slate-400 light:text-slate-600">
            {isBroadcasting 
              ? "Your camera and microphone are being broadcasted directly from the browser."
              : "Set up your live stream details before broadcasting."}
          </p>
        </div>
      </div>

      {!isBroadcasting && !loading && (
        <div className="mt-8 space-y-6">
          <VideoMetadataFields
            value={{
              title,
              description,
              category: "Live",
              contentType: "video",
              spokenLanguage: "auto",
              visibility,
              madeForKids: false,
              ageRestricted: false,
              commentsEnabled,
              tags: [],
              membersOnly: false,
            }}
            onChange={handleMetadataChange}
            categories={CATEGORIES}
            allowContentTypeChange={false}
            aiGenerating={aiGenerating}
            onOpenAITitleAssist={() => setAiTitleAssistOpen(true)}
            aiError={aiType === "title" ? aiError : null}
            aiSuggestions={aiType === "title" ? aiSuggestions : []}
          />
        </div>
      )}

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
          <div className="text-sm text-slate-400 light:text-slate-600 flex-1">
            {isBroadcasting && creds ? (
              <div className="flex gap-4 items-center">
                <button 
                  onClick={toggleMic}
                  className={`p-3 rounded-full ${isMicMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                  title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button 
                  onClick={toggleVideo}
                  className={`p-3 rounded-full ${isVideoMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                  title={isVideoMuted ? "Turn On Camera" : "Turn Off Camera"}
                >
                  {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              </div>
            ) : (
              "Fill out the details above, then click the button to go live instantly."
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
              End Stream
            </button>
          )}
        </div>
        
        {error && (
          <div className="p-4 bg-red-500/10 border-t border-red-500/20 text-red-400 text-sm font-medium text-center">
            {error}
          </div>
        )}
      </div>

      <AITitleAssistModal
        open={aiTitleAssistOpen}
        onClose={() => setAiTitleAssistOpen(false)}
        initialDescription={description}
        generating={aiGenerating}
        error={aiType === "title" ? aiError : null}
        suggestions={aiType === "title" ? aiSuggestions : []}
        onGenerate={(userDescription) => handleGenerateAI("title", userDescription)}
        onPick={(pickedTitle) => {
          setTitle(pickedTitle);
          setAiTitleAssistOpen(false);
        }}
      />
    </div>
  );
}
