import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { checkMonetizationEligibility, MonetizationState } from "@/app/lib/monetization";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    
    // Fetch the current saved state
    const userResult = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        ProjectionExpression: "monetizationStatus, monetizedAt, suspensionReason"
      })
    );
    
    const dbStatus = userResult.Item?.monetizationStatus || "NOT_ELIGIBLE";
    
    // Always check live eligibility to power the UI
    const eligibility = await checkMonetizationEligibility(user.userId);
    
    // If they aren't marked as monetized yet, update their reported status based on engine
    let effectiveStatus = dbStatus;
    if (dbStatus === "NOT_ELIGIBLE" && eligibility.isEligible) {
      effectiveStatus = "ELIGIBLE";
    } else if (dbStatus === "ELIGIBLE" && !eligibility.isEligible) {
      effectiveStatus = "NOT_ELIGIBLE";
    }
    
    const state: MonetizationState = {
      status: effectiveStatus,
      monetizedAt: userResult.Item?.monetizedAt,
      suspensionReason: userResult.Item?.suspensionReason
    };
    
    return NextResponse.json({ state, eligibility });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
