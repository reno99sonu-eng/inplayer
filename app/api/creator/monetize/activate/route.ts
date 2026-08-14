import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { checkMonetizationEligibility } from "@/app/lib/monetization";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    
    // Check if already monetized
    const userResult = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        ProjectionExpression: "monetizationStatus"
      })
    );
    
    if (userResult.Item?.monetizationStatus === "MONETIZED") {
      return NextResponse.json({ error: "Already monetized" }, { status: 400 });
    }
    
    if (userResult.Item?.monetizationStatus === "SUSPENDED" || userResult.Item?.monetizationStatus === "DISABLED") {
      return NextResponse.json({ error: "Cannot activate monetization due to account status" }, { status: 400 });
    }
    
    // Re-verify eligibility server-side (Enforces the "backend enforces all rules" architecture)
    const eligibility = await checkMonetizationEligibility(user.userId);
    
    if (!eligibility.isEligible) {
      return NextResponse.json({ error: "Not eligible for monetization" }, { status: 400 });
    }
    
    // Activate
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        UpdateExpression: "SET monetizationStatus = :s, monetizedAt = :t",
        ExpressionAttributeValues: {
          ":s": "MONETIZED",
          ":t": now
        }
      })
    );
    
    return NextResponse.json({ success: true, monetizedAt: now });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
