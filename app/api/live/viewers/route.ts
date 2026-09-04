import { NextRequest, NextResponse } from "next/server";
import { IvsClient, GetStreamCommand } from "@aws-sdk/client-ivs";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Live viewer count for a broadcast the caller owns.
//
// This route exists because there was no way to ask "how many people are
// watching right now" from a client at all — the website's live viewer page
// is a server component reading DynamoDB directly, and DynamoDB does not
// hold a viewer count. IVS is the only thing that knows, and only the
// server may ask it, since doing so needs the AWS credentials.
//
// Deliberately owner-only. The viewer count is a broadcaster-facing
// statistic here, and leaving it open would let anyone poll audience
// numbers for any channel on the platform.
const ivsClient = new IvsClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  const getRes = await docClient.send(
    new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
  );
  const video = getRes.Item;
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  if (video.uploaderId !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const channelArn = video.ivsChannelArn;
  if (typeof channelArn !== "string" || !channelArn) {
    return NextResponse.json(
      { error: "That stream has no IVS channel." },
      { status: 400 }
    );
  }

  try {
    const res = await ivsClient.send(
      new GetStreamCommand({ channelArn })
    );
    const stream = res.stream;
    // IVS reports -1 when it cannot determine the count yet; that is "not
    // known", not "nobody", so it is normalised to 0 rather than shown.
    const rawCount = Number(stream?.viewerCount ?? 0);
    return NextResponse.json({
      live: stream?.state === "LIVE",
      viewerCount: Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0,
      health: stream?.health ?? null,
      startedAt: stream?.startTime ?? null,
    });
  } catch (err) {
    // ChannelNotBroadcasting is the NORMAL answer in the window between
    // creating the channel and the encoder actually connecting, and again
    // after the broadcast stops. It is not an error worth surfacing — the
    // honest answer is simply "not live yet".
    const name = (err as { name?: string })?.name || "";
    if (name === "ChannelNotBroadcasting" || name === "ResourceNotFoundException") {
      return NextResponse.json({ live: false, viewerCount: 0, health: null, startedAt: null });
    }
    console.error("live/viewers: IVS GetStream failed:", err);
    return NextResponse.json(
      { error: "Couldn't read the viewer count right now." },
      { status: 502 }
    );
  }
}
