import { NextRequest, NextResponse } from "next/server";
import mux from "@/app/lib/mux";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Creates a Mux live stream and returns the credentials the creator needs
// to broadcast from streaming software (OBS, Streamlabs, etc.): the RTMP
// ingest URL + a private stream key, plus the public playback ID viewers
// (and the preview on the Go Live page) watch through.
export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in to go live." },
      { status: 401 }
    );
  }

  try {
    const liveStream = await mux.video.liveStreams.create({
      playback_policy: ["public"],
      new_asset_settings: { playback_policy: ["public"] },
      // If the encoder briefly drops, Mux waits this many seconds for it to
      // reconnect before ending the stream.
      reconnect_window: 60,
    });

    return NextResponse.json({
      streamKey: liveStream.stream_key,
      playbackId: liveStream.playback_ids?.[0]?.id || null,
      // Mux's standard global RTMP ingest endpoint.
      rtmpUrl: "rtmp://global-live.mux.com:5222/app",
    });
  } catch (err) {
    console.error("Failed to create live stream:", err);
    return NextResponse.json(
      { error: "Couldn't start a live stream. Please try again." },
      { status: 500 }
    );
  }
}
