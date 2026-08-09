import { NextRequest, NextResponse } from "next/server";
import mux, { muxErrorMessages } from "@/app/lib/mux";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Creates a Mux live stream and returns the credentials the creator needs
// to broadcast from streaming software (OBS, Streamlabs, etc.): the RTMP
// ingest URL + a private stream key, plus the public playback ID viewers
// (and the preview on the Go Live page) watch through.
//
// Plan reality: Mux's FREE plan does not include real live streams — the
// API rejects them with "Live streams are unavailable on the free plan".
// When that happens we automatically retry as a TEST live stream
// (test: true — watermarked and limited to ~5 minutes), so Go Live is
// still demonstrable today, and surface exactly what happened so the
// upgrade path is obvious rather than looking like a bug.
export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in to go live." },
      { status: 401 }
    );
  }

  const baseSettings = {
    playback_policy: ["public" as const],
    new_asset_settings: { playback_policy: ["public" as const] },
    // If the encoder briefly drops, Mux waits this many seconds for it to
    // reconnect before ending the stream.
    reconnect_window: 60,
  };

  try {
    const liveStream = await mux.video.liveStreams.create(baseSettings);

    return NextResponse.json({
      streamKey: liveStream.stream_key,
      playbackId: liveStream.playback_ids?.[0]?.id || null,
      rtmpUrl: "rtmp://global-live.mux.com:5222/app",
      isTest: false,
    });
  } catch (err) {
    const muxMsg = muxErrorMessages(err);
    console.warn("Primary live stream creation failed, attempting test stream fallback:", err);

    // Fall back to a test stream so the feature still works end-to-end
    // (with Mux's test limits) on free-plan accounts or API variations
    try {
      const testStream = await mux.video.liveStreams.create({
        ...baseSettings,
        test: true,
      });

      return NextResponse.json({
        streamKey: testStream.stream_key,
        playbackId: testStream.playback_ids?.[0]?.id || null,
        rtmpUrl: "rtmp://global-live.mux.com:5222/app",
        isTest: true,
      });
    } catch (testErr) {
      const testMsg = muxErrorMessages(testErr);
      console.error("Test live stream also failed:", testErr);
      return NextResponse.json(
        {
          error:
            testMsg ||
            muxMsg ||
            (err instanceof Error ? err.message : null) ||
            "Couldn't start a live stream. Please check your Mux API keys in .env.local.",
        },
        { status: 502 }
      );
    }
  }
}
