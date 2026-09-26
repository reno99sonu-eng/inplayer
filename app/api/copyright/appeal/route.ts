import { NextRequest, NextResponse } from "next/server";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createNotification } from "@/app/lib/notifications";
import { extractVideoId } from "../report/route";

const REPORTS_TABLE = "InPlayer-Reports";

export async function POST(request: NextRequest) {
  let user: { userId: string; email?: string };
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "You must be signed in to submit a copyright counter-notice or appeal." },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const videoInput = typeof body.videoId === "string" ? body.videoId.trim() : "";
  const appealBasis = typeof body.appealBasis === "string" ? body.appealBasis.trim() : "";
  const explanation = typeof body.explanation === "string" ? body.explanation.trim() : "";
  const evidenceUrls = typeof body.evidenceUrls === "string" ? body.evidenceUrls.trim() : "";
  const goodFaithConfirmed = body.goodFaithConfirmed === true;
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  // Validation according to Section 19 & 20 of InPlayer Copyright Policy
  if (!fullName) {
    return NextResponse.json({ error: "Full legal name is required." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (!videoInput) {
    return NextResponse.json(
      { error: "Video URL or Video ID under appeal is required." },
      { status: 400 }
    );
  }
  if (!appealBasis) {
    return NextResponse.json(
      { error: "A legal basis for the counter-notice or appeal is required." },
      { status: 400 }
    );
  }
  if (!explanation || explanation.length < 15) {
    return NextResponse.json(
      { error: "A clear explanation of at least 15 characters is required." },
      { status: 400 }
    );
  }
  if (!goodFaithConfirmed) {
    return NextResponse.json(
      { error: "You must confirm the good-faith statement under penalty of applicable law." },
      { status: 400 }
    );
  }
  if (!signature) {
    return NextResponse.json(
      { error: "Electronic signature (typed full legal name) is required." },
      { status: 400 }
    );
  }

  const cleanVideoId = extractVideoId(videoInput);
  const reportId = randomUUID();

  let targetTitle = typeof body.videoTitle === "string" && body.videoTitle.trim() ? body.videoTitle.trim() : "Appealed Video";
  try {
    const video = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: cleanVideoId },
        ProjectionExpression: "title, uploaderId",
      })
    );
    if (video.Item?.title) {
      targetTitle = video.Item.title as string;
    }
  } catch {
    /* lookup best-effort */
  }

  const details = `[Counter-Notice / Copyright Appeal] Creator: ${fullName} <${email}${phone ? `, ${phone}` : ""}>. Basis: ${appealBasis}. Statement: ${explanation}${evidenceUrls ? ` | Documentation: ${evidenceUrls}` : ""}. Signature: ${signature}`;

  try {
    await docClient.send(
      new PutCommand({
        TableName: REPORTS_TABLE,
        Item: {
          reportId,
          targetType: "video",
          videoId: cleanVideoId,
          targetTitle,
          reason: "copyright_appeal",
          status: "open",
          priority: "normal",
          isCounterNotice: true,
          uploaderId: user.userId,
          reporterId: user.userId,
          reporterEmail: email,
          creatorName: fullName,
          creatorEmail: email,
          creatorPhone: phone,
          appealBasis,
          explanation,
          evidenceUrls,
          goodFaithConfirmed: true,
          signature,
          details: details.slice(0, 2000),
          createdAt: new Date().toISOString(),
        },
      })
    );

    // Send in-app confirmation notification to creator
    await createNotification({
      userId: user.userId,
      type: "admin_announcement",
      message: `Your copyright counter-notice/appeal for "${targetTitle}" has been received and is under review by InPlayer administration.`,
      videoId: cleanVideoId,
    }).catch(() => {
      /* notification failure non-fatal */
    });

    return NextResponse.json({
      success: true,
      reportId,
      message: "Counter-notice / appeal received successfully.",
    });
  } catch (err) {
    console.error("Failed to save counter-notice appeal:", err);
    return NextResponse.json(
      { error: "Couldn't submit appeal right now. Please try again or email support@inplayer.in." },
      { status: 500 }
    );
  }
}
