import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

interface Params {
  params: Promise<{ videoId: string }>;
}

// Streams the actual MP4 back through our own domain (rather than
// sending the viewer straight to stream.mux.com) so we can set
// Content-Disposition with a real filename and get a reliable, same-origin
// download in every browser — a cross-origin `<a download>` to Mux isn't
// honored consistently everywhere.
export async function GET(request: NextRequest, { params }: Params) {
  const { videoId } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  const video = result.Item;

  if (!video || video.contentType === "short") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const renditions: Record<string, string> = video.downloadRenditions || {};

  // The viewer picks a quality (?quality=720p). Fall back to the stored
  // default filename, then to any available rendition, so a request always
  // resolves to a real file when the download is ready.
  const requestedQuality = request.nextUrl.searchParams.get("quality") || "";
  const fileName =
    renditions[requestedQuality] ||
    video.downloadFileName ||
    Object.values(renditions)[0];

  if (video.downloadStatus !== "ready" || !video.muxPlaybackId || !fileName) {
    return NextResponse.json(
      { error: "Download not ready yet." },
      { status: 409 }
    );
  }

  const muxUrl = `https://stream.mux.com/${video.muxPlaybackId}/${fileName}`;

  let muxRes: Response;

  try {
    muxRes = await fetch(muxUrl);
  } catch (err) {
    console.error("Failed to fetch static rendition from Mux:", err);
    return NextResponse.json(
      { error: "Couldn't fetch the video file." },
      { status: 502 }
    );
  }

  if (!muxRes.ok || !muxRes.body) {
    console.error(`Mux returned ${muxRes.status} for ${muxUrl}`);
    return NextResponse.json(
      { error: "Couldn't fetch the video file." },
      { status: 502 }
    );
  }

  const safeTitle =
    (video.title || "video")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "video";

  // Reflect the actual quality in the downloaded filename (e.g. Title-720p.mp4).
  const qualityLabel = fileName.replace(/\.(mp4|m4a)$/, "");
  const downloadName = qualityLabel
    ? `${safeTitle}-${qualityLabel}.mp4`
    : `${safeTitle}.mp4`;

  const headers = new Headers();
  headers.set("Content-Type", "video/mp4");
  headers.set("Content-Disposition", `attachment; filename="${downloadName}"`);

  const contentLength = muxRes.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(muxRes.body, { headers });
}
