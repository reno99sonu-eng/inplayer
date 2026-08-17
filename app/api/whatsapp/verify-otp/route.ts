import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { docClient } from "@/app/lib/dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { otp, phone } = await request.json();
    if (!otp || !phone) {
      return NextResponse.json({ error: "OTP and phone are required." }, { status: 400 });
    }

    // Fetch the user's stored OTP
    const getRes = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId }
      })
    );

    const record = getRes.Item;
    if (!record || !record.checkoutOtp) {
      return NextResponse.json({ error: "No OTP found. Please request a new one." }, { status: 400 });
    }

    // Verify phone matches
    if (record.checkoutPhone !== phone) {
      return NextResponse.json({ error: "Phone number mismatch." }, { status: 400 });
    }

    // Verify expiry
    if (new Date(record.checkoutOtpExpiry) < new Date()) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    // Verify OTP matches
    if (record.checkoutOtp !== otp) {
      return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
    }

    // Clear the OTP to prevent reuse
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        UpdateExpression: "REMOVE checkoutOtp, checkoutOtpExpiry"
      })
    );

    return NextResponse.json({ success: true, message: "OTP verified successfully." });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Failed to verify OTP." }, { status: 500 });
  }
}
