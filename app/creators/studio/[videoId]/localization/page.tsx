"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { ArrowLeft, Save, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { CAPTION_TARGETS } from "@/app/lib/captions";

export default function LocalizationConsole() {
  const params = useParams<{ videoId: string }>();
  const router = useRouter();
  const { signedIn, authLoading } = useAuthModal();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [video, setVideo] = useState<any>(null);
  
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [selectedLang, setSelectedLang] = useState<string>("hi");
  const [vttContent, setVttContent] = useState<string>("");
  
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!signedIn) {
      router.push("/");
      return;
    }

    async function fetchVideo() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        const res = await fetch(`/api/my-videos/${params.videoId}`, {
          headers: { Authorization: `Bearer ${idToken}` }
        });

        if (res.ok) {
          const data = await res.json();
          setVideo(data.video);
          if (data.video.captionsVtt) {
             setCaptions(data.video.captionsVtt);
             if (data.video.captionsVtt[selectedLang]) {
                setVttContent(data.video.captionsVtt[selectedLang]);
             }
          }
        }
      } catch (err) {
        console.error("Failed to load video", err);
      } finally {
        setLoading(false);
      }
    }

    fetchVideo();
  }, [signedIn, authLoading, params.videoId]);

  const handleLangChange = (code: string) => {
    setSelectedLang(code);
    setVttContent(captions[code] || "");
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      
      const res = await fetch(`/api/creators/studio/${params.videoId}/localization`, {
        method: "PATCH",
        headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          languageCode: selectedLang,
          vttContent: vttContent
        })
      });

      if (res.ok) {
         setCaptions(prev => ({ ...prev, [selectedLang]: vttContent }));
         setMessage({ type: "success", text: "Subtitle track updated and synced to Mux!" });
      } else {
         const errData = await res.json();
         setMessage({ type: "error", text: errData.error || "Failed to update." });
      }
    } catch (err) {
       console.error(err);
       setMessage({ type: "error", text: "An error occurred." });
    } finally {
       setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#08111F] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!video) {
    return <div className="p-10 text-white">Video not found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#08111F] text-white">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/my-videos" className="rounded-full bg-white/10 p-2 hover:bg-white/20 transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Localization Console</h1>
            <p className="text-sm text-slate-400">Editing Subtitles for: {video.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 flex flex-col gap-2">
            <h3 className="font-semibold mb-2">Target Languages</h3>
            {CAPTION_TARGETS.filter(t => t.code !== "en").map(target => {
               const hasTrack = !!captions[target.code];
               return (
                 <button 
                   key={target.code}
                   onClick={() => handleLangChange(target.code)}
                   className={`flex items-center justify-between p-3 rounded-xl border transition ${
                     selectedLang === target.code 
                       ? "bg-orange-500/20 border-orange-500" 
                       : "bg-white/5 border-white/10 hover:bg-white/10"
                   }`}
                 >
                   <span>{target.name} ({target.label})</span>
                   {hasTrack && <span className="h-2 w-2 rounded-full bg-green-500"></span>}
                 </button>
               )
            })}
          </div>

          <div className="md:col-span-3">
             <div className="bg-[#121A28] border border-white/10 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-xl font-bold">{CAPTION_TARGETS.find(t => t.code === selectedLang)?.name} Translation</h2>
                   
                   <button 
                     onClick={handleSave}
                     disabled={saving || !vttContent}
                     className="flex items-center gap-2 bg-orange-500 text-slate-900 px-4 py-2 rounded-full font-bold hover:bg-orange-400 transition disabled:opacity-50"
                   >
                     {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                     Save & Sync Track
                   </button>
                </div>

                {message && (
                  <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {message.text}
                  </div>
                )}

                <p className="text-sm text-slate-400 mb-4">
                  Make corrections to the Bhashini/AI translation below. DO NOT change the timestamps or WebVTT formatting structure.
                </p>

                <textarea 
                  value={vttContent}
                  onChange={(e) => setVttContent(e.target.value)}
                  placeholder="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nNo translation available yet."
                  className="w-full h-[500px] bg-black/30 border border-white/10 rounded-xl p-4 text-slate-300 font-mono text-sm focus:outline-none focus:border-orange-500 transition"
                />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
