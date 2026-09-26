import { NextRequest, NextResponse } from "next/server";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

const REPORTS_TABLE = "InPlayer-Reports";

export function extractVideoId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  // Match patterns like /watch/{id}, watch?v={id}, or bare video ID
  const watchMatch = trimmed.match(/\/watch\/([a-zA-Z0-9_-]+)/i);
  if (watchMatch && watchMatch[1]) return watchMatch[1];

  const queryMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/i);
  if (queryMatch && queryMatch[1]) return queryMatch[1];

  // If it contains no slashes or spaces, assume it is already a video ID
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;

  return trimmed;
}

export async function POST(request: NextRequest) {
  let user: { userId: string; email?: string } | null = null;
  try {
    user = await verifyAuth(request);
  } catch {
    // Statutory copyright notices may be submitted by external rights holders or legal counsel
    user = null;
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
  const workTitle = typeof body.workTitle === "string" ? body.workTitle.trim() : "";
  const workType = typeof body.workType === "string" ? body.workType.trim() : "video";
  const ownershipBasis = typeof body.ownershipBasis === "string" ? body.ownershipBasis.trim() : "";
  const infringingUrl = typeof body.infringingUrl === "string" ? body.infringingUrl.trim() : "";
  const infringingDescription =
    typeof body.infringingDescription === "string" ? body.infringingDescription.trim() : "";
  const goodFaithConfirmed = body.goodFaithConfirmed === true;
  const accuracyConfirmed = body.accuracyConfirmed === true;
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  // Validation according to Section 10 of InPlayer Copyright Policy
  if (!fullName) {
    return NextResponse.json({ error: "Full legal name is required." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid contact email is required." }, { status: 400 });
  }
  if (!workTitle) {
    return NextResponse.json({ error: "Identification of the copyrighted work is required." }, { status: 400 });
  }
  if (!ownershipBasis) {
    return NextResponse.json(
      { error: "Explanation of ownership or authority is required." },
      { status: 400 }
    );
  }
  if (!infringingUrl) {
    return NextResponse.json(
      { error: "URL or location of allegedly infringing content is required." },
      { status: 400 }
    );
  }
  if (!infringingDescription) {
    return NextResponse.json(
      { error: "Explanation of why the content is infringing is required." },
      { status: 400 }
    );
  }
  if (!goodFaithConfirmed) {
    return NextResponse.json(
      { error: "You must confirm the good-faith statement." },
      { status: 400 }
    );
  }
  if (!accuracyConfirmed) {
    return NextResponse.json(
      { error: "You must confirm the declaration of accuracy and authority." },
      { status: 400 }
    );
  }
  if (!signature) {
    return NextResponse.json(
      { error: "Electronic signature (typed full legal name) is required." },
      { status: 400 }
    );
  }

  const parsedVideoId = extractVideoId(infringingUrl);
  const reportId = randomUUID();
  const reporterId = user?.userId || `ext_${randomUUID().slice(0, 8)}`;

  // Best-effort lookup to see if target video exists
  let targetTitle = "Reported Content";
  try {
    const video = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: parsedVideoId },
        ProjectionExpression: "title",
      })
    );
    if (video.Item?.title) {
      targetTitle = video.Item.title as string;
    }
  } catch {
    /* video lookup best-effort */
  }

  const details = `[Formal Copyright Notice] Work: "${workTitle}" (${workType}, ${ownershipBasis}) by ${fullName} <${email}${phone ? `, ${phone}` : ""}>. Infringement: ${infringingDescription}. Signature: ${signature}`;

  try {
    await docClient.send(
      new PutCommand({
        TableName: REPORTS_TABLE,
        Item: {
          reportId,
          targetType: "video",
          videoId: parsedVideoId,
          targetTitle,
          reason: "copyright",
          status: "open",
          priority: "high",
          isFormalNotice: true,
          reporterId,
          reporterEmail: email,
          complainantName: fullName,
          complainantEmail: email,
          complainantPhone: phone,
          workTitle,
          workType,
          ownershipBasis,
          infringingUrl,
          infringingDescription,
          goodFaithConfirmed: true,
          accuracyConfirmed: true,
          signature,
          details: details.slice(0, 2000),
          createdAt: new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({
      success: true,
      reportId,
      message: "Copyright complaint received and queued for review.",
    });
  } catch (err) {
    console.error("Failed to save formal copyright notice:", err);
    return NextResponse.json(
      { error: "Couldn't submit copyright complaint right now. Please try again or email support@inplayer.in." },
      { status: 500 }
    );
  }
}
