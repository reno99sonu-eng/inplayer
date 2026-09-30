import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getApplicationByUserId, submitApplication, isApprovedFilmCreator } from "@/app/lib/raftaarFilms";
import { docClient } from "@/app/lib/dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isApproved = await isApprovedFilmCreator(auth.userId, auth.email);
    const application = await getApplicationByUserId(auth.userId);
    const effectiveApproved = isApproved || application?.status === "approved";
    return NextResponse.json({
      application: application || null,
      isApproved: effectiveApproved,
      status: effectiveApproved ? "approved" : (application?.status || "none"),
    });
  } catch (error: any) {
    console.error("Error in GET /api/raftaar-films/apply:", error?.name, error?.message, error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingApp = await getApplicationByUserId(auth.userId);
    if (existingApp) {
      return NextResponse.json({ error: "Application already exists" }, { status: 409 });
    }

    const body = await request.json();
    const channelName = body.channelName?.trim();
    const personalName = body.personalName?.trim() || body.legalName?.trim();
    const username = body.username?.trim() || body.handle?.trim();
    const phoneNumber = body.phoneNumber?.trim() || body.phone?.trim();
    const email = body.email?.trim();
    const companyName = body.companyName?.trim() || undefined;

    if (!channelName || !personalName || !username || !phoneNumber || !email) {
      return NextResponse.json(
        { error: "Channel name, personal name, username, phone number, and email are required." },
        { status: 400 }
      );
    }

    const application = await submitApplication({
      userId: auth.userId,
      channelName,
      personalName,
      username,
      phoneNumber,
      email,
      companyName,
    });

    // Seed or update InPlayer-Users with creator profile information
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Users",
          Key: { userId: auth.userId },
          UpdateExpression:
            "SET #n = if_not_exists(#n, :name), username = if_not_exists(username, :username), email = if_not_exists(email, :email), phoneNumber = if_not_exists(phoneNumber, :phone), channelName = if_not_exists(channelName, :channelName)",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: {
            ":name": personalName,
            ":username": username,
            ":email": email,
            ":phone": phoneNumber,
            ":channelName": channelName,
          },
        })
      );
    } catch (seedErr) {
      console.warn("Could not seed InPlayer-Users during application submission:", seedErr);
    }

    return NextResponse.json({ application }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/raftaar-films/apply:", error?.name, error?.message, error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

