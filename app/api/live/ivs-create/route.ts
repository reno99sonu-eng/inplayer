import { NextRequest, NextResponse } from "next/server";
import { IVSClient, CreateChannelCommand } from "@aws-sdk/client-ivs";
import { verifyAuth } from "@/app/lib/verifyAuth";

const ivsClient = new IVSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    
    // Create an IVS channel
    const command = new CreateChannelCommand({
      name: `live-stream-${user.id}-${Date.now()}`,
      latencyMode: "LOW",
      type: "STANDARD",
      insecureIngest: false,
      authorized: false,
    });

    const response = await ivsClient.send(command);

    if (!response.channel || !response.streamKey) {
      throw new Error("Failed to create IVS channel");
    }

    return NextResponse.json({
      ingestEndpoint: response.channel.ingestEndpoint,
      streamKey: response.streamKey.value,
      playbackUrl: response.channel.playbackUrl,
      channelArn: response.channel.arn,
    });
  } catch (err) {
    console.error("Failed to create IVS channel:", err);
    return NextResponse.json(
      { error: "Couldn't initialize live stream." },
      { status: 500 }
    );
  }
}
